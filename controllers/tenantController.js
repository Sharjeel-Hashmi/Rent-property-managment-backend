import Tenant from "../models/Tenant.js";
import Property from "../models/Property.js";
import RentPayment from "../models/RentPayment.js";
import Bill from "../models/Bill.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Helper: keep room status in sync with active tenants
const syncRoomStatus = async (propertyId) => {
  const property = await Property.findById(propertyId);
  if (!property) return;

  const activeTenants = await Tenant.find({
    property: propertyId,
    status: { $ne: "moved-out" },
  });

  property.rooms.forEach((room) => {
    const occupied = activeTenants.some((t) => t.rooms.includes(room.roomNumber));
    room.status = occupied ? "occupied" : "vacant";
  });

  await property.save();
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

// Shared shortfall calculation — used both at "Give Notice" time (with the
// planned date) and again at "Finalize Move-Out" time (with the actual
// date), so the deduction always reflects the notice the landlord ACTUALLY
// got, not just what was originally planned.
const calcNoticeShortfall = (noticeGivenDate, referenceDate, requiredNoticeWeeks) => {
  const noticeDate = new Date(noticeGivenDate);
  const refDate = new Date(referenceDate);
  const actualNoticeDays = Math.round((refDate - noticeDate) / MS_PER_DAY);
  const requiredDays = (requiredNoticeWeeks || 4) * 7;
  const shortfallDays = Math.max(requiredDays - actualNoticeDays, 0);
  const deductionApplicable = shortfallDays > 15;
  return { actualNoticeDays, shortfallDays, deductionApplicable };
};

// @desc Get all tenants (optionally filter by property)
export const getTenants = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;
    if (req.query.status) filter.status = req.query.status;

    const tenants = await Tenant.find(filter)
      .populate("property", "name address")
      .populate("sharingWith", "fullName")
      .sort({ createdAt: -1 });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get single tenant
export const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate("property")
      .populate("sharingWith", "fullName");
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Create tenant
export const createTenant = async (req, res) => {
  try {
    const tenant = await Tenant.create(req.body);

    // if sharing a room, link back to the other tenant(s)
    if (tenant.sharingWith?.length) {
      await Tenant.updateMany(
        { _id: { $in: tenant.sharingWith } },
        { $addToSet: { sharingWith: tenant._id } }
      );
    }

    // create two rent cycles up front:
    // 1) move-in month's rent — due right on the move-in date itself
    // 2) the following month's rent — due exactly one month after move-in
    // (normalized to UTC midnight so local-dev and Vercel-prod always agree)
    const moveInDueDate = new Date(tenant.moveInDate);
    moveInDueDate.setUTCHours(0, 0, 0, 0);

    const nextDueDate = new Date(moveInDueDate);
    nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 1);

    await RentPayment.create([
      { tenant: tenant._id, property: tenant.property, dueDate: moveInDueDate, amount: tenant.rentAmount },
      { tenant: tenant._id, property: tenant.property, dueDate: nextDueDate, amount: tenant.rentAmount },
    ]);

    tenant.nextRentDueDate = moveInDueDate;
    await tenant.save();

    await syncRoomStatus(tenant.property);
    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update tenant
export const updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    await syncRoomStatus(tenant.property);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete tenant
export const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    await Tenant.updateMany(
      { sharingWith: tenant._id },
      { $pull: { sharingWith: tenant._id } }
    );

    const propertyId = tenant.property;
    await RentPayment.deleteMany({ tenant: tenant._id });
    await tenant.deleteOne();
    await syncRoomStatus(propertyId);

    res.json({ message: "Tenant deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Give notice for a tenant - calculates shortfall + deduction flag
// Rule: required notice = 4 weeks (28 days) starting from the notice-given date.
// If the notice actually given falls short of the required period by more
// than 15 days, a deduction from the advance/deposit becomes applicable.
export const giveNotice = async (req, res) => {
  try {
    const { noticeGivenDate, plannedMoveOutDate } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const noticeDate = new Date(noticeGivenDate);
    const moveOutDate = new Date(plannedMoveOutDate);

    const { shortfallDays, deductionApplicable } = calcNoticeShortfall(
      noticeDate,
      moveOutDate,
      tenant.requiredNoticeWeeks
    );

    tenant.status = "notice-given";
    tenant.noticeGivenDate = noticeDate;
    tenant.plannedMoveOutDate = moveOutDate;
    tenant.noticeShortfallDays = shortfallDays;
    tenant.deductionApplicable = deductionApplicable;

    await tenant.save();
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Toggle tenant's deposit paid/unpaid status
export const toggleDeposit = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    tenant.depositPaid = !tenant.depositPaid;
    tenant.depositPaidDate = tenant.depositPaid ? new Date() : undefined;

    await tenant.save();
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Unpaid rent owed as of a given move-out date:
// - A cycle that hasn't started yet (dueDate after moveOutDate) isn't
//   charged at all — the tenant never lived in that period.
// - A cycle the tenant lived through completely is charged in full.
// - The one cycle the move-out date actually falls inside is PRORATED —
//   only the days actually lived in that cycle are charged.
const calcUnpaidRentTotal = async (tenantId, moveOutDate) => {
  const moveOut = new Date(moveOutDate);
  const unpaidRentRecords = await RentPayment.find({ tenant: tenantId, isPaid: false }).sort({ dueDate: 1 });

  let total = 0;
  for (const record of unpaidRentRecords) {
    const cycleStart = new Date(record.dueDate);
    if (cycleStart > moveOut) continue; // this rent period hadn't started yet — don't charge

    const cycleEnd = addMonths(cycleStart, 1);
    if (moveOut >= cycleEnd) {
      total += record.amount; // tenant lived through the whole cycle
    } else {
      const daysInCycle = Math.round((cycleEnd - cycleStart) / MS_PER_DAY);
      const daysLived = Math.round((moveOut - cycleStart) / MS_PER_DAY);
      total += (record.amount * daysLived) / daysInCycle;
    }
  }
  return Math.round(total * 100) / 100; // round to cents
};

// @desc Calculate remaining deposit summary (used before/at move-out)
// remainingDeposit = depositAmount - (shortfallPenalty + unpaidRentTotal + unpaidBillsTotal)
export const getDepositSummary = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const moveOutCandidate = req.query.moveOutDate || tenant.plannedMoveOutDate || new Date();
    const unpaidRentTotal = await calcUnpaidRentTotal(tenant._id, moveOutCandidate);

    const bills = await Bill.find({
      tenants: { $elemMatch: { tenant: tenant._id, isPaid: false } },
    });
    const unpaidBillsTotal = bills.reduce((sum, bill) => {
      const share = bill.tenants.find((t) => String(t.tenant) === String(tenant._id));
      return sum + (share && !share.isPaid ? share.shareAmount || 0 : 0);
    }, 0);

    // If a candidate move-out date is passed (used for the live preview in
    // the Finalize Move-Out modal, before it's confirmed), recalculate the
    // notice shortfall against THAT date instead of relying on whatever was
    // frozen in at "Give Notice" time.
    let deductionApplicable = tenant.deductionApplicable;
    let noticeShortfallDays = tenant.noticeShortfallDays;
    if (tenant.noticeGivenDate && req.query.moveOutDate) {
      const calc = calcNoticeShortfall(tenant.noticeGivenDate, req.query.moveOutDate, tenant.requiredNoticeWeeks);
      deductionApplicable = calc.deductionApplicable;
      noticeShortfallDays = calc.shortfallDays;
    }

    const shortfallPenalty = deductionApplicable ? tenant.deductionAmount || 0 : 0;

    const totalDeductions = shortfallPenalty + unpaidRentTotal + unpaidBillsTotal;
    const remainingDeposit = (tenant.depositAmount || 0) - totalDeductions;

    res.json({
      depositAmount: tenant.depositAmount || 0,
      shortfallPenalty,
      unpaidRentTotal,
      unpaidBillsTotal,
      totalDeductions,
      remainingDeposit,
      deductionApplicable,
      noticeShortfallDays,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Finalize move-out
export const moveOutTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const finalMoveOutDate = req.body.moveOutDate || new Date();
    const unpaidRentTotal = await calcUnpaidRentTotal(tenant._id, finalMoveOutDate);

    const bills = await Bill.find({
      tenants: { $elemMatch: { tenant: tenant._id, isPaid: false } },
    });
    const unpaidBillsTotal = bills.reduce((sum, bill) => {
      const share = bill.tenants.find((t) => String(t.tenant) === String(tenant._id));
      return sum + (share && !share.isPaid ? share.shareAmount || 0 : 0);
    }, 0);

    // Recalculate the notice shortfall against the ACTUAL move-out date being
    // confirmed here — not the frozen value from "Give Notice" time — so an
    // earlier-than-planned (or later-than-planned) departure is judged
    // correctly.
    let deductionApplicable = false;
    let noticeShortfallDays = tenant.noticeShortfallDays || 0;
    if (tenant.noticeGivenDate) {
      const calc = calcNoticeShortfall(tenant.noticeGivenDate, finalMoveOutDate, tenant.requiredNoticeWeeks);
      deductionApplicable = calc.deductionApplicable;
      noticeShortfallDays = calc.shortfallDays;
    }

    const shortfallPenalty = deductionApplicable ? (req.body.deductionAmount ?? tenant.deductionAmount ?? 0) : 0;

    tenant.status = "moved-out";
    tenant.moveOutDate = finalMoveOutDate;
    tenant.deductionApplicable = deductionApplicable;
    tenant.noticeShortfallDays = noticeShortfallDays;
    if (req.body.deductionAmount !== undefined) tenant.deductionAmount = req.body.deductionAmount;
    if (req.body.deductionNote) tenant.deductionNote = req.body.deductionNote;

    tenant.remainingDepositAmount =
      (tenant.depositAmount || 0) - (shortfallPenalty + unpaidRentTotal + unpaidBillsTotal);

    await tenant.save();
    await syncRoomStatus(tenant.property);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};