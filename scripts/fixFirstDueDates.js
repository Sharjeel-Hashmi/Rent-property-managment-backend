// One-time fix: corrects the FIRST rent due date for tenants who have never
// paid yet, from the old formula (move-in + 10 days) to the new one
// (move-in + 1 month).
//
// SAFE BY DESIGN:
// - Only touches a tenant if they have exactly ONE rent cycle total and it
//   is still unpaid (i.e. they've never made a payment yet — so we can
//   never disturb anyone who has already progressed through paid cycles).
// - Only changes a record if its current due date matches the OLD formula
//   exactly — anything that looks manually adjusted or different is skipped.
// - Runs in DRY RUN mode by default (shows what WOULD change, saves nothing).
//   Add --apply to actually save the changes.
//
// Usage (from the backend/ folder):
//   node scripts/fixFirstDueDates.js            -> dry run (preview only)
//   node scripts/fixFirstDueDates.js --apply    -> actually applies the fix
//
// Make sure backend/.env's MONGO_URI points to whichever database you want
// to fix (local or Atlas) before running.

import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]); // same fix used in server.js — helps resolve Atlas SRV records
import mongoose from "mongoose";
import dotenv from "dotenv";
import Tenant from "../models/Tenant.js";
import RentPayment from "../models/RentPayment.js";

dotenv.config();

const APPLY = process.argv.includes("--apply");

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB.`);
  console.log(APPLY ? "Mode: APPLY (changes will be saved)\n" : "Mode: DRY RUN (no changes will be saved — add --apply to save)\n");

  const tenants = await Tenant.find({});
  let fixedCount = 0;

  for (const tenant of tenants) {
    const records = await RentPayment.find({ tenant: tenant._id }).sort({ dueDate: 1 });

    // Only tenants who have never paid their first cycle yet.
    if (records.length !== 1 || records[0].isPaid) continue;

    const record = records[0];

    // Only touch it if it matches the OLD (move-in + 10 days) formula.
    const oldExpected = new Date(tenant.moveInDate);
    oldExpected.setHours(0, 0, 0, 0);
    oldExpected.setDate(oldExpected.getDate() + 10);

    if (!sameDay(new Date(record.dueDate), oldExpected)) continue;

    const newDueDate = new Date(tenant.moveInDate);
    newDueDate.setHours(0, 0, 0, 0);
    newDueDate.setMonth(newDueDate.getMonth() + 1);

    console.log(
      `${tenant.fullName}: ${record.dueDate.toDateString()}  ->  ${newDueDate.toDateString()}`
    );

    if (APPLY) {
      record.dueDate = newDueDate;
      await record.save();
      tenant.nextRentDueDate = newDueDate;
      await tenant.save();
    }
    fixedCount++;
  }

  console.log(`\n${APPLY ? "Fixed" : "Would fix"} ${fixedCount} tenant(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});