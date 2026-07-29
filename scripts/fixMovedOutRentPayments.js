// One-time cleanup: a timezone bug (server-local vs UTC) used to let duplicate
// "next month" rent cycles get created. For tenants who have since moved out,
// this leaves behind phantom unpaid rent records dated AFTER their move-out
// date — which wrongly inflate the "unpaid rent" deduction in their deposit
// refund calculation.
//
// This script, for every "moved-out" tenant:
//   1. Finds RentPayment records with a dueDate AFTER their moveOutDate
//      (a moved-out tenant can have no legitimate rent cycle after that date).
//   2. Deletes those phantom records.
//   3. Recalculates remainingDepositAmount using only genuine records
//      (dueDate on/before moveOutDate) + shortfall penalty + unpaid bills,
//      and saves the corrected figure on the tenant.
//
// SAFE BY DESIGN:
// - Only ever touches tenants whose status is already "moved-out".
// - Only deletes rent records dated strictly after that tenant's own
//   recorded move-out date — never touches an active tenant's cycles.
// - Dry run by default (shows what WOULD change, deletes/saves nothing).
//   Add --apply to actually apply the fix.
//
// Usage (from the backend/ folder):
//   node scripts/fixMovedOutRentPayments.js            -> dry run (preview only)
//   node scripts/fixMovedOutRentPayments.js --apply    -> actually applies the fix

import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]); // same fix used in server.js — helps resolve Atlas SRV records
import mongoose from "mongoose";
import dotenv from "dotenv";
import Tenant from "../models/Tenant.js";
import RentPayment from "../models/RentPayment.js";
import Bill from "../models/Bill.js";

dotenv.config();

const APPLY = process.argv.includes("--apply");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB.`);
  console.log(APPLY ? "Mode: APPLY (changes will be saved)\n" : "Mode: DRY RUN (no changes will be saved — add --apply to save)\n");

  const movedOutTenants = await Tenant.find({ status: "moved-out" });
  let touchedCount = 0;

  for (const tenant of movedOutTenants) {
    if (!tenant.moveOutDate) continue;

    const phantomRecords = await RentPayment.find({
      tenant: tenant._id,
      dueDate: { $gt: tenant.moveOutDate },
    });

    // Genuine unpaid rent = cycles due on/before the move-out date that were
    // never paid (real arrears — these still count against the deposit).
    const genuineUnpaid = await RentPayment.find({
      tenant: tenant._id,
      isPaid: false,
      dueDate: { $lte: tenant.moveOutDate },
    });
    const unpaidRentTotal = genuineUnpaid.reduce((sum, r) => sum + r.amount, 0);

    const bills = await Bill.find({
      tenants: { $elemMatch: { tenant: tenant._id, isPaid: false } },
    });
    const unpaidBillsTotal = bills.reduce((sum, bill) => {
      const share = bill.tenants.find((t) => String(t.tenant) === String(tenant._id));
      return sum + (share && !share.isPaid ? share.shareAmount || 0 : 0);
    }, 0);

    const shortfallPenalty = tenant.deductionApplicable ? tenant.deductionAmount || 0 : 0;
    const correctedRemainingDeposit =
      (tenant.depositAmount || 0) - (shortfallPenalty + unpaidRentTotal + unpaidBillsTotal);

    if (phantomRecords.length === 0 && correctedRemainingDeposit === tenant.remainingDepositAmount) {
      continue; // nothing to fix for this tenant
    }

    console.log(`${tenant.fullName}:`);
    console.log(`  Phantom future rent records to delete: ${phantomRecords.length}`);
    console.log(`  remainingDepositAmount: €${tenant.remainingDepositAmount} -> €${correctedRemainingDeposit}`);

    if (APPLY) {
      if (phantomRecords.length > 0) {
        await RentPayment.deleteMany({ _id: { $in: phantomRecords.map((r) => r._id) } });
      }
      tenant.remainingDepositAmount = correctedRemainingDeposit;
      await tenant.save();
    }
    touchedCount++;
  }

  console.log(`\n${APPLY ? "Fixed" : "Would fix"} ${touchedCount} tenant(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Script error:", err.message);
  process.exit(1);
});