const isSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== "superadmin") {
    return res.status(403).json({ message: "Only Super Admin can perform this action" });
  }
  next();
};

export default isSuperAdmin;