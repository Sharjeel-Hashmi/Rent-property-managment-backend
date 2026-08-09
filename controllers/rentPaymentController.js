import RentPayment from "../models/RentPayment.js";
import Tenant from "../models/Tenant.js";

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // strip time-of-day so due dates compare/match reliably
  d.setMonth(d.getMonth() + months);
  return d;
};

// @desc Get the current (most relevant - earliest unpaid, else latest) rent cycle for a tenant
export const getCurrentRentCycle = async (req, res) => {
  try {
    const { tenantId } = req.params;

    let record = await RentPayment.findOne({ tenant: tenantId, owner: req.admin.id, isPaid: false }).sort({ dueDate: 1 });

    if (!record) {
      record = await RentPayment.findOne({ tenant: tenantId, owner: req.admin.id }).sort({ dueDate: -1 });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Full rent history for a tenant, newest first
export const getRentHistory = async (req, res) => {
  try {
    const records = await RentPayment.find({ tenant: req.params.tenantId, owner: req.admin.id }).sort({ dueDate: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Toggle paid / unpaid. When marking paid, auto-generate the next
// month's due cycle (due date = this due date + 1 month) if it doesn't exist yet.
export const toggleRentPaymentStatus = async (req, res) => {
  try {
    const record = await RentPayment.findOne({ _id: req.params.id, owner: req.admin.id });
    if (!record) return res.status(404).json({ message: "Rent record not found" });

    record.isPaid = !record.isPaid;
    record.paidDate = record.isPaid ? new Date() : undefined;
    await record.save();

    if (record.isPaid) {
      try {
        const nextDueDate = addMonths(record.dueDate, 1);
        const exists = await RentPayment.findOne({ tenant: record.tenant, owner: req.admin.id, dueDate: nextDueDate });

        if (!exists) {
          const tenant = await Tenant.findOne({ _id: record.tenant, owner: req.admin.id });
          if (tenant && tenant.status !== "moved-out") {
            await RentPayment.create({
              owner: req.admin.id,
              tenant: record.tenant,
              property: record.property,
              dueDate: nextDueDate,
              amount: tenant.rentAmount,
            });
            tenant.nextRentDueDate = nextDueDate;
            await tenant.save();
          }
        }
      } catch (nextCycleErr) {
        // Paid status is already saved above — a hiccup creating next month's
        // cycle (e.g. a duplicate due-date race) should not fail this request.
        console.error("Could not auto-create next rent cycle:", nextCycleErr.message);
      }
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc List all tenants whose rent is currently overdue (for the dashboard alert)
export const getOverdueRentTenants = async (req, res) => {
  try {
    const today = new Date();
    const overdueRecords = await RentPayment.find({ owner: req.admin.id, isPaid: false, dueDate: { $lt: today } })
      .populate({
        path: "tenant",
        select: "fullName phone status",
        match: { status: { $ne: "moved-out" } },
      })
      .populate("property", "name")
      .sort({ dueDate: 1 });

    const filtered = overdueRecords.filter((r) => r.tenant);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};