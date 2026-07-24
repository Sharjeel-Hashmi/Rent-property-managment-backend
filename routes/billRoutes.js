import express from "express";
import {
  getBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  payTenantShare,
} from "../controllers/billController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getBills).post(createBill);
router.route("/:id").get(getBillById).put(updateBill).delete(deleteBill);
router.route("/:id/pay/:tenantId").put(payTenantShare);

export default router;