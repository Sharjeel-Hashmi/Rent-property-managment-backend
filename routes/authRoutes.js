import express from "express";
import {
  registerAdmin,
  verifyOtp,
  resendOtp,
  loginAdmin,
  getProfile,
  updateProfile,
  getAllAdmins,
  deleteAdmin,
} from "../controllers/authController.js";
import protect from "../middleware/auth.js";
import isSuperAdmin from "../middleware/isSuperAdmin.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", loginAdmin);

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

router.get("/admins", protect, isSuperAdmin, getAllAdmins);
router.delete("/admins/:id", protect, isSuperAdmin, deleteAdmin);

export default router;