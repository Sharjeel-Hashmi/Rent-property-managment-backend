import express from "express";
import { registerAdmin, loginAdmin, getProfile } from "../controllers/authController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/profile", protect, getProfile);

export default router;
