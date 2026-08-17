import mongoose from "mongoose";

const propertyExpenseSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    category: { type: String, required: true }, // e.g. Plumbing, Heating, Electrical, or a custom category
    title: { type: String, required: true }, // e.g. Property Tax, Maintenance, Electrical Work
    detail: { type: String },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },

    image: {
      data: { type: String }, // base64
      contentType: { type: String },
      fileName: { type: String },
    },

    // Split between selected tenants of the property (equal split)
    splitBetween: [
      {
        tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
        shareAmount: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("PropertyExpense", propertyExpenseSchema);