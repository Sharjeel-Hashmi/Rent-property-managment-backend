import Bill from "../models/Bill.js";

// @desc Get bills (filter by property or tenant)
export const getBills = async (req, res) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;
    if (req.query.tenant) filter["tenants.tenant"] = req.query.tenant;

    const bills = await Bill.find(filter)
      .populate("property", "name")
      .populate("tenants.tenant", "fullName")
      .sort({ billDate: -1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get single bill
export const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate("property", "name")
      .populate("tenants.tenant", "fullName");
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Create bill (with optional attachment as base64 sent from frontend)
export const createBill = async (req, res) => {
  try {
    const bill = await Bill.create(req.body);
    const populated = await bill.populate([
      { path: "property", select: "name" },
      { path: "tenants.tenant", select: "fullName" },
    ]);
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update bill
export const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("property", "name")
      .populate("tenants.tenant", "fullName");
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete bill
export const deleteBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    await bill.deleteOne();
    res.json({ message: "Bill deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Toggle a single tenant's paid/unpaid status within a bill
export const payTenantShare = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const share = bill.tenants.find((t) => String(t.tenant) === String(req.params.tenantId));
    if (!share) return res.status(404).json({ message: "This tenant is not part of this bill" });

    share.isPaid = !share.isPaid;
    share.paidDate = share.isPaid ? new Date() : undefined;

    await bill.save();
    const populated = await bill.populate([
      { path: "property", select: "name" },
      { path: "tenants.tenant", select: "fullName" },
    ]);
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};