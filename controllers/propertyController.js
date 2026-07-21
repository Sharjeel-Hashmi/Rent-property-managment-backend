import Property from "../models/Property.js";
import Tenant from "../models/Tenant.js";

// @desc Get all properties
export const getProperties = async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get single property with its rooms + tenants
export const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const tenants = await Tenant.find({ property: property._id }).sort({ createdAt: -1 });

    res.json({ property, tenants });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Create property
export const createProperty = async (req, res) => {
  try {
    const property = await Property.create(req.body);
    res.status(201).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update property
export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!property) return res.status(404).json({ message: "Property not found" });
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete property
export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const tenantCount = await Tenant.countDocuments({
      property: property._id,
      status: { $ne: "moved-out" },
    });
    if (tenantCount > 0) {
      return res.status(400).json({
        message: "Cannot delete property with active tenants. Remove tenants first.",
      });
    }

    await property.deleteOne();
    res.json({ message: "Property deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Add a room to a property
export const addRoom = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    property.rooms.push(req.body);
    property.totalRooms = property.rooms.length;
    await property.save();
    res.status(201).json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update a room
export const updateRoom = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const room = property.rooms.id(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    Object.assign(room, req.body);
    await property.save();
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Delete a room
export const deleteRoom = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: "Property not found" });

    property.rooms.pull({ _id: req.params.roomId });
    property.totalRooms = property.rooms.length;
    await property.save();
    res.json(property);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
