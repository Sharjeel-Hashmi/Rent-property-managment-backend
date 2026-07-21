import express from "express";
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  addRoom,
  updateRoom,
  deleteRoom,
} from "../controllers/propertyController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getProperties).post(createProperty);
router.route("/:id").get(getPropertyById).put(updateProperty).delete(deleteProperty);
router.route("/:id/rooms").post(addRoom);
router.route("/:id/rooms/:roomId").put(updateRoom).delete(deleteRoom);

export default router;
