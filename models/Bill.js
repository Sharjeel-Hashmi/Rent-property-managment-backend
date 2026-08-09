import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    billType: {
      type: String,
      enum: ["Electricity", "Gas", "Internet", "Water", "Other"],
      required: true,
    },

    // Billing period this bill covers (can span multiple months, e.g. 2-3 month bills)
    billPeriodStart: { type: Date },
    billPeriodEnd: { type: Date },

    // How the total amount was divided among tenants
    splitMethod: { type: String, enum: ["equal", "prorate"], default: "equal" },

    totalAmount: { type: Number, required: true },
    billDate: { type: Date, required: true },
    dueDate: { type: Date },

    // Tenant(s) this bill applies to. Each tenant has their own paid status now,
    // so partial payment (some members paid, some not) can be tracked per bill.
    tenants: [
      {
        tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
        shareAmount: { type: Number },
        daysPresent: { type: Number },
        isPaid: { type: Boolean, default: false },
        paidDate: { type: Date },
      },
    ],

    attachment: {
      data: { type: String }, // base64
      contentType: { type: String },
      fileName: { type: String },
    },

    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);