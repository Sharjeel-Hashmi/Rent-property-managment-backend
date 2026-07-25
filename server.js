import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import tenantRoutes from "./routes/tenantRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import rentPaymentRoutes from "./routes/rentPaymentRoutes.js";
import propertyExpenseRoutes from "./routes/propertyExpenseRoutes.js";

dotenv.config();
await connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" })); // higher limit to allow base64 file uploads
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.get("/", (req, res) => {
  res.send("Rent Property Management API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/tenants", tenantRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/rent-payments", rentPaymentRoutes);
app.use("/api/property-expenses", propertyExpenseRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server error", error: err.message });
});

const PORT = process.env.PORT || 5000;

// Vercel runs this file as a serverless function and imports the `app` export,
// so we only start a normal listening server when running locally.
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;