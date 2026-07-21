import RentPayment from "../models/RentPayment.js";
import Tenant from "../models/Tenant.js";

// @desc Get the rent record for a tenant for a given month.
// If it doesn't exist yet, auto-create it using the tenant's current rent amount.
export const getOrCreateRentPayment = async (req, res) => {
  try {
    const { tenant: tenantId, month } = req.query;
    if (!tenantId || !month) {
      return res.status(400).json({ message: "tenant and month are required" });
    }

    let record = await RentPayment.findOne({ tenant: tenantId, month });

    if (!record) {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) return res.status(404).json({ message: "Tenant not found" });

      record = await RentPayment.create({
        tenant: tenant._id,
        property: tenant.property,
        month,
        amount: tenant.rentAmount,
      });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get all rent payment history for a tenant
export const getRentPaymentsForTenant = async (req, res) => {
  try {
    const records = await RentPayment.find({ tenant: req.params.tenantId }).sort({ month: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Toggle paid / unpaid status
export const toggleRentPaymentStatus = async (req, res) => {
  try {
    const record = await RentPayment.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Rent record not found" });

    record.isPaid = !record.isPaid;
    record.paidDate = record.isPaid ? new Date() : undefined;
    await record.save();

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update rent amount for a specific month (in case of a one-off adjustment)
export const updateRentPayment = async (req, res) => {
  try {
    const record = await RentPayment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!record) return res.status(404).json({ message: "Rent record not found" });
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
