import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    billType: {
      type: String,
      enum: ["Electricity", "Gas", "Internet", "Water", "Other"],
      required: true,
    },
    billPeriodMonth: { type: String }, // "YYYY-MM" - the calendar month this bill covers (used for proration)
    totalAmount: { type: Number, required: true },
    billDate: { type: Date, required: true },
    dueDate: { type: Date },

    // Tenant(s) this bill applies to. If split, multiple tenants share totalAmount.
    tenants: [
      {
        tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
        shareAmount: { type: Number },
      },
    ],

    attachment: {
      data: { type: String }, // base64
      contentType: { type: String },
      fileName: { type: String },
    },

    isPaid: { type: Boolean, default: false },
    paidDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
