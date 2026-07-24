import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    // Personal Details
    fullName: { type: String, required: true },
    email: { type: String },
    phone: { type: String, required: true },
    dob: { type: Date },
    nationality: { type: String },
    ppsNumber: { type: String }, // Ireland PPS Number
    idType: {
      type: String,
      enum: ["Passport", "Driving License", "National ID", "Other"],
    },
    idNumber: { type: String },
    idDocument: {
      data: { type: String }, // base64
      contentType: { type: String },
      fileName: { type: String },
    },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
    currentAddressBeforeMoveIn: { type: String },

    // Property / Room Assignment
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    rentScope: {
      type: String,
      enum: ["single-room", "multi-room", "full-property"],
      default: "single-room",
    },
    rooms: [{ type: String }], // room numbers assigned

    // Shared room handling
    sharingWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tenant" }],

    // Rent & Deposit
    rentAmount: { type: Number, required: true }, // this tenant's share of rent
    rentFrequency: {
      type: String,
      enum: ["weekly", "monthly"],
      default: "monthly",
    },
    depositAmount: { type: Number, default: 0 },
    depositPaid: { type: Boolean, default: false },
    remainingDepositAmount: { type: Number }, // calculated at move-out

    // Rent due cycle
    nextRentDueDate: { type: Date },

    // Dates & Status
    moveInDate: { type: Date, required: true },
    moveOutDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "notice-given", "moved-out"],
      default: "active",
    },

    // Notice period tracking
    noticeGivenDate: { type: Date },
    requiredNoticeWeeks: { type: Number, default: 4 },
    plannedMoveOutDate: { type: Date },
    noticeShortfallDays: { type: Number, default: 0 },
    deductionApplicable: { type: Boolean, default: false },
    deductionAmount: { type: Number, default: 0 },
    deductionNote: { type: String },

    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Tenant", tenantSchema);
