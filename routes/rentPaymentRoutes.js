import express from "express";
import {
  getOrCreateRentPayment,
  getRentPaymentsForTenant,
  toggleRentPaymentStatus,
  updateRentPayment,
} from "../controllers/rentPaymentController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getOrCreateRentPayment); // ?tenant=id&month=YYYY-MM
router.get("/tenant/:tenantId", getRentPaymentsForTenant);
router.put("/:id/toggle", toggleRentPaymentStatus);
router.put("/:id", updateRentPayment);

export default router;
