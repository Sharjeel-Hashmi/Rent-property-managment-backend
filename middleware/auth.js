import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

const protect = async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith("Bearer")) {
    try {
      token = token.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.id).select("-password -otpCode -otpExpiresAt");
      if (!admin) {
        return res.status(401).json({ message: "Not authorized, admin not found" });
      }
      req.admin = { id: admin._id.toString(), role: admin.role, email: admin.email, name: admin.name };
      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized, invalid token" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

export default protect;