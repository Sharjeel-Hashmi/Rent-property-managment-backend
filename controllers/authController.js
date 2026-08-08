import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../utils/sendEmail.js";

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// @desc Signup Step 1 — create pending admin & send OTP
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await Admin.findOne({ email: normalizedEmail });

    if (existing && existing.isVerified) {
      return res.status(400).json({ message: "This email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (existing && !existing.isVerified) {
      existing.name = name;
      existing.phone = phone;
      existing.password = hashedPassword;
      existing.otpCode = otp;
      existing.otpExpiresAt = otpExpiresAt;
      await existing.save();
    } else {
      await Admin.create({
        name,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
        role: "admin",
        isVerified: false,
        otpCode: otp,
        otpExpiresAt,
      });
    }

    await sendOtpEmail(normalizedEmail, name, otp);
    res.status(200).json({ message: "Verification code sent to your email", email: normalizedEmail });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Signup Step 2 — verify OTP, activate account
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and code are required" });

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) return res.status(404).json({ message: "No signup found for this email" });
    if (admin.isVerified) return res.status(400).json({ message: "This account is already verified" });
    if (!admin.otpCode || !admin.otpExpiresAt || admin.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: "Code expired. Please request a new one" });
    }
    if (admin.otpCode !== otp) return res.status(400).json({ message: "Incorrect verification code" });

    admin.isVerified = true;
    admin.otpCode = undefined;
    admin.otpExpiresAt = undefined;
    await admin.save();

    res.status(200).json({ message: "Account verified successfully. You can now log in." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Resend OTP
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin) return res.status(404).json({ message: "No signup found for this email" });
    if (admin.isVerified) return res.status(400).json({ message: "This account is already verified" });

    const otp = generateOtp();
    admin.otpCode = otp;
    admin.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await admin.save();
    await sendOtpEmail(admin.email, admin.name, otp);

    res.status(200).json({ message: "A new verification code has been sent" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Login admin
export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!admin.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      token: generateToken(admin._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Get logged-in admin profile
export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("-password -otpCode -otpExpiresAt");
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Update own profile (name, phone, password, email)
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, currentPassword, newPassword, newEmail } = req.body;
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    if (name) admin.name = name;
    if (phone) admin.phone = phone;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to set a new password" });
      }
      const match = await bcrypt.compare(currentPassword, admin.password);
      if (!match) return res.status(400).json({ message: "Current password is incorrect" });
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(newPassword, salt);
    }

    if (newEmail && newEmail.toLowerCase().trim() !== admin.email) {
      if (!isValidEmail(newEmail)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      const taken = await Admin.findOne({ email: newEmail.toLowerCase().trim(), isVerified: true });
      if (taken) return res.status(400).json({ message: "This email is already registered" });

      const otp = generateOtp();
      admin.email = newEmail.toLowerCase().trim();
      admin.isVerified = false;
      admin.otpCode = otp;
      admin.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await admin.save();
      await sendOtpEmail(admin.email, admin.name, otp);
      return res.status(200).json({
        message: "Email updated. Please verify your new email with the code we sent.",
        requiresVerification: true,
        email: admin.email,
      });
    }

    await admin.save();
    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Super Admin — list all admins
export const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().select("-password -otpCode -otpExpiresAt").sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Super Admin — remove an admin
export const deleteAdmin = async (req, res) => {
  try {
    const target = await Admin.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Admin not found" });
    if (target.role === "superadmin") {
      return res.status(403).json({ message: "Super Admin accounts cannot be removed" });
    }
    if (target._id.toString() === req.admin.id) {
      return res.status(403).json({ message: "You cannot remove your own account" });
    }

    await target.deleteOne();
    res.status(200).json({ message: "Admin removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc One-time browser-triggered Super Admin creation (bypasses local machine entirely,
// runs on the deployed Vercel backend). Protected by a secret query param, and refuses
// to run again once a matching account already exists.
export const seedSuperAdminOnce = async (req, res) => {
  try {
    const { secret } = req.query;
    if (!secret || secret !== process.env.SEED_SECRET) {
      return res.status(403).json({ message: "Invalid or missing secret" });
    }

    const name = process.env.SUPERADMIN_NAME;
    const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
    const phone = process.env.SUPERADMIN_PHONE;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: "SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PHONE, SUPERADMIN_PASSWORD are not set in Vercel env vars",
      });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists. Nothing was created." });
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

    res.status(200).json({ message: `Super Admin created successfully: ${email}. You can now log in.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};