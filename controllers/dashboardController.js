import mongoose from "mongoose";
import Property from "../models/Property.js";
import Tenant from "../models/Tenant.js";
import Bill from "../models/Bill.js";
import RentPayment from "../models/RentPayment.js";
import PropertyExpense from "../models/PropertyExpense.js";

export const getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.admin.id;
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    const properties = await Property.find({ owner: ownerId });
    const totalProperties = properties.length;

    let totalRooms = 0;
    let occupiedRooms = 0;
    properties.forEach((p) => {
      totalRooms += p.rooms.length;
      occupiedRooms += p.rooms.filter((r) => r.status === "occupied").length;
    });

    const activeTenants = await Tenant.countDocuments({ owner: ownerId, status: "active" });
    const noticeTenants = await Tenant.countDocuments({ owner: ownerId, status: "notice-given" });
    const unpaidBills = await Bill.countDocuments({
      owner: ownerId,
      tenants: { $elemMatch: { isPaid: false } },
    });

    const rentDueMembersCount = await RentPayment.countDocuments({
      owner: ownerId,
      isPaid: false,
      dueDate: { $lt: new Date() },
    });

    const monthlyRentAgg = await Tenant.aggregate([
      { $match: { owner: ownerObjectId, status: { $ne: "moved-out" } } },
      { $group: { _id: null, total: { $sum: "$rentAmount" } } },
    ]);

    res.json({
      totalProperties,
      totalRooms,
      occupiedRooms,
      vacantRooms: totalRooms - occupiedRooms,
      activeTenants,
      noticeTenants,
      unpaidBills,
      rentDueMembersCount,
      totalMonthlyRent: monthlyRentAgg[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Net profit, collection rate, monthly/yearly rent-vs-expense trend and
// this month's expense breakdown by category — powers the dashboard charts.
export const getFinanceOverview = async (req, res) => {
  try {
    const ownerId = req.admin.id;
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const range = req.query.range === "yearly" ? "yearly" : "monthly";

    const now = new Date();
    const bucketCount = range === "yearly" ? 5 : 6;
    const periods = [];

    if (range === "monthly") {
      for (let i = bucketCount - 1; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        periods.push({ label: start.toLocaleDateString("en-GB", { month: "short" }), start, end });
      }
    } else {
      for (let i = bucketCount - 1; i >= 0; i--) {
        const year = now.getFullYear() - i;
        periods.push({ label: String(year), start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) });
      }
    }

    const monthlyTrend = [];
    for (const p of periods) {
      const [rentAgg, expenseAgg] = await Promise.all([
        RentPayment.aggregate([
          { $match: { owner: ownerObjectId, isPaid: true, paidDate: { $gte: p.start, $lt: p.end } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        PropertyExpense.aggregate([
          { $match: { owner: ownerObjectId, date: { $gte: p.start, $lt: p.end } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);
      monthlyTrend.push({
        label: p.label,
        rent: rentAgg[0]?.total || 0,
        expense: expenseAgg[0]?.total || 0,
        start: p.start.toISOString(),
        end: p.end.toISOString(),
      });
    }

    // Current month collection rate + net profit
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const dueThisMonthAgg = await RentPayment.aggregate([
      { $match: { owner: ownerObjectId, dueDate: { $gte: monthStart, $lt: monthEnd } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          paid: { $sum: { $cond: ["$isPaid", "$amount", 0] } },
        },
      },
    ]);
    const totalDueThisMonth = dueThisMonthAgg[0]?.total || 0;
    const totalPaidThisMonth = dueThisMonthAgg[0]?.paid || 0;
    const collectionRate = totalDueThisMonth > 0 ? Math.round((totalPaidThisMonth / totalDueThisMonth) * 100) : 100;

    const expensesThisMonthAgg = await PropertyExpense.aggregate([
      { $match: { owner: ownerObjectId, date: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const expensesThisMonth = expensesThisMonthAgg[0]?.total || 0;
    const netProfitThisMonth = totalPaidThisMonth - expensesThisMonth;

    // Expense breakdown by title (top 4 + "Other"), this month
    const expenseBreakdownAgg = await PropertyExpense.aggregate([
      { $match: { owner: ownerObjectId, date: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: "$title", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);
    let expenseBreakdown = expenseBreakdownAgg.map((e) => ({ title: e._id, amount: e.total }));
    if (expenseBreakdown.length > 5) {
      const top = expenseBreakdown.slice(0, 4);
      const rest = expenseBreakdown.slice(4);
      const otherTotal = rest.reduce((sum, e) => sum + e.amount, 0);
      expenseBreakdown = [...top, { title: "Other", amount: otherTotal, otherTitles: rest.map((e) => e.title) }];
    }

    res.json({
      range,
      monthlyTrend,
      expenseBreakdown,
      collectionRate,
      totalDueThisMonth,
      totalPaidThisMonth,
      expensesThisMonth,
      netProfitThisMonth,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Actual rent-collected and expense records for a clicked trend-chart
// bar's date range (start/end come from the monthlyTrend buckets above).
export const getPeriodDetail = async (req, res) => {
  try {
    const ownerId = req.admin.id;
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: "start and end are required" });

    const startDate = new Date(start);
    const endDate = new Date(end);

    const [rentPayments, expenses] = await Promise.all([
      RentPayment.find({ owner: ownerId, isPaid: true, paidDate: { $gte: startDate, $lt: endDate } })
        .populate("tenant", "fullName")
        .populate("property", "name")
        .sort({ paidDate: -1 }),
      PropertyExpense.find({ owner: ownerId, date: { $gte: startDate, $lt: endDate } })
        .populate("property", "name")
        .sort({ date: -1 }),
    ]);

    const totalRent = rentPayments.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({ rentPayments, expenses, totalRent, totalExpense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Per-tenant rent status for the current cycle — collected vs pending,
// used by the "Monthly Rent Total" drilldown.
export const getRentBreakdown = async (req, res) => {
  try {
    const ownerId = req.admin.id;

    const tenants = await Tenant.find({ owner: ownerId, status: { $ne: "moved-out" } })
      .populate("property", "name")
      .select("fullName rentAmount property");

    const records = await RentPayment.find({ owner: ownerId }).sort({ dueDate: -1 });

    const latestByTenant = {};
    records.forEach((r) => {
      const key = String(r.tenant);
      if (!latestByTenant[key]) latestByTenant[key] = r;
    });

    const breakdown = tenants.map((t) => {
      const record = latestByTenant[String(t._id)];
      return {
        tenantId: t._id,
        fullName: t.fullName,
        propertyName: t.property?.name || "-",
        rentAmount: t.rentAmount,
        dueDate: record?.dueDate || null,
        isPaid: record?.isPaid ?? false,
      };
    });

    const collected = breakdown.filter((b) => b.isPaid).reduce((s, b) => s + b.rentAmount, 0);
    const pending = breakdown.filter((b) => !b.isPaid).reduce((s, b) => s + b.rentAmount, 0);

    res.json({ tenants: breakdown, collected, pending });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};