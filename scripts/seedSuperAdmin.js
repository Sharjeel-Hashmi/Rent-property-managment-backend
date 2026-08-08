// Run once locally: node scripts/seedSuperAdmin.js
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import Admin from "../models/Admin.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const name = process.env.SUPERADMIN_NAME;
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const phone = process.env.SUPERADMIN_PHONE;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!name || !email || !phone || !password) {
    console.error("Set SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PHONE, SUPERADMIN_PASSWORD in backend/.env first.");
    process.exit(1);
  }

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log("An account with this email already exists. Aborting.");
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await Admin.create({
    name,
    email,
    phone,
    password: hashedPassword,
    role: "superadmin",
    isVerified: true,
  });

  console.log(`Super Admin created: ${email}`);
  process.exit(0);
};

run();