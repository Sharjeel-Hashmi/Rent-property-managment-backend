import express from "express";
import {
  getDashboardStats,
  getFinanceOverview,
  getRentBreakdown,
  getPeriodDetail,
} from "../controllers/dashboardController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.get("/stats", protect, getDashboardStats);
router.get("/finance", protect, getFinanceOverview);
router.get("/rent-breakdown", protect, getRentBreakdown);
router.get("/period-detail", protect, getPeriodDetail);

export default router;