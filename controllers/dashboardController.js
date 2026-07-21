import Property from "../models/Property.js";
import Tenant from "../models/Tenant.js";
import Bill from "../models/Bill.js";

export const getDashboardStats = async (req, res) => {
  try {
    const properties = await Property.find();
    const totalProperties = properties.length;

    let totalRooms = 0;
    let occupiedRooms = 0;
    properties.forEach((p) => {
      totalRooms += p.rooms.length;
      occupiedRooms += p.rooms.filter((r) => r.status === "occupied").length;
    });

    const activeTenants = await Tenant.countDocuments({ status: "active" });
    const noticeTenants = await Tenant.countDocuments({ status: "notice-given" });
    const unpaidBills = await Bill.countDocuments({ isPaid: false });

    const monthlyRentAgg = await Tenant.aggregate([
      { $match: { status: { $ne: "moved-out" } } },
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
      totalMonthlyRent: monthlyRentAgg[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
