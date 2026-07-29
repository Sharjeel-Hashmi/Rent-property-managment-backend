import express from "express";
import {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  giveNotice,
  moveOutTenant,
  getDepositSummary,
  toggleDeposit,
} from "../controllers/tenantController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getTenants).post(createTenant);
router.route("/:id").get(getTenantById).put(updateTenant).delete(deleteTenant);
router.route("/:id/notice").put(giveNotice);
router.route("/:id/move-out").put(moveOutTenant);
router.route("/:id/deposit-summary").get(getDepositSummary);
router.route("/:id/toggle-deposit").put(toggleDeposit);

export default router;