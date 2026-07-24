import express from "express";
import {
  getCurrentRentCycle,
  getRentHistory,
  toggleRentPaymentStatus,
  getOverdueRentTenants,
} from "../controllers/rentPaymentController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/overdue", getOverdueRentTenants);
router.get("/current/:tenantId", getCurrentRentCycle);
router.get("/history/:tenantId", getRentHistory);
router.put("/:id/toggle", toggleRentPaymentStatus);

export default router;