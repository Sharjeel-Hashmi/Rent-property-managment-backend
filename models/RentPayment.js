import mongoose from "mongoose";

const rentPaymentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paidDate: { type: Date },
  },
  { timestamps: true }
);

// one rent cycle per tenant per due date
rentPaymentSchema.index({ tenant: 1, dueDate: 1 }, { unique: true });

export default mongoose.model("RentPayment", rentPaymentSchema);