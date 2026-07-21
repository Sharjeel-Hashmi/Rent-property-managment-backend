import mongoose from "mongoose";

const rentPaymentSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    month: { type: String, required: true }, // format "YYYY-MM"
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paidDate: { type: Date },
  },
  { timestamps: true }
);

// one rent record per tenant per month
rentPaymentSchema.index({ tenant: 1, month: 1 }, { unique: true });

export default mongoose.model("RentPayment", rentPaymentSchema);
