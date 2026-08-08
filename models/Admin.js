import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "superadmin"], default: "admin" },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);