// Run once locally, AFTER deploying the owner-scoping changes:
// node scripts/migrateDataToSuperAdmin.js
//
// Finds the Super Admin account and assigns all existing Property, Tenant,
// Bill, RentPayment, and PropertyExpense records (that don't yet have an
// "owner") to that Super Admin, so no data is lost when per-admin data
// isolation goes live.
import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.js";
import Property from "../models/Property.js";
import Tenant from "../models/Tenant.js";
import Bill from "../models/Bill.js";
import RentPayment from "../models/RentPayment.js";
import PropertyExpense from "../models/PropertyExpense.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const superAdmin = await Admin.findOne({ role: "superadmin" });
  if (!superAdmin) {
    console.error("No Super Admin account found. Create one first (npm run seed:superadmin), then re-run this script.");
    process.exit(1);
  }

  console.log(`Assigning existing data to Super Admin: ${superAdmin.email}`);

  const models = [
    { name: "Property", model: Property },
    { name: "Tenant", model: Tenant },
    { name: "Bill", model: Bill },
    { name: "RentPayment", model: RentPayment },
    { name: "PropertyExpense", model: PropertyExpense },
  ];

  for (const { name, model } of models) {
    const result = await model.updateMany(
      { owner: { $exists: false } },
      { $set: { owner: superAdmin._id } }
    );
    console.log(`${name}: ${result.modifiedCount} record(s) updated`);
  }

  console.log("Migration complete.");
  process.exit(0);
};

run();