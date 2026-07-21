import Tenant from "../models/Tenant.js";
import Property from "../models/Property.js";

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
    await tenant.deleteOne();
    await syncRoomStatus(propertyId);

    res.json({ message: "Tenant deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Give notice for a tenant - calculates shortfall + deduction flag
// Rule: required notice = 4 weeks (28 days). If the notice actually given
// falls short of the required period by more than 15 days, a deduction
// from the advance/deposit becomes applicable. Admin enters the final
// deduction amount manually after review.
export const giveNotice = async (req, res) => {
  try {
    const { noticeGivenDate, plannedMoveOutDate } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const noticeDate = new Date(noticeGivenDate);
    const moveOutDate = new Date(plannedMoveOutDate);

    const actualNoticeDays = Math.round((moveOutDate - noticeDate) / MS_PER_DAY);
    const requiredDays = (tenant.requiredNoticeWeeks || 4) * 7;
    const shortfallDays = Math.max(requiredDays - actualNoticeDays, 0);
    const deductionApplicable = shortfallDays > 15;

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

// @desc Finalize move-out
export const moveOutTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    tenant.status = "moved-out";
    tenant.moveOutDate = req.body.moveOutDate || new Date();
    if (req.body.deductionAmount !== undefined) tenant.deductionAmount = req.body.deductionAmount;
    if (req.body.deductionNote) tenant.deductionNote = req.body.deductionNote;

    await tenant.save();
    await syncRoomStatus(tenant.property);
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
