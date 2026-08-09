import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  capacity: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ["vacant", "occupied"],
    default: "vacant",
  },
  notes: { type: String },
});

const propertySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    county: { type: String },
    eircode: { type: String },
    totalRooms: { type: Number, required: true },
    rentType: {
      type: String,
      enum: ["room-wise", "full-property"],
      default: "room-wise",
    },
    rooms: [roomSchema],
    description: { type: String },
    image: {
      data: { type: String },
      contentType: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Property", propertySchema);