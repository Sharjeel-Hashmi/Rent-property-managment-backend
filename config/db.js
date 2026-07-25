import mongoose from "mongoose";

// On Vercel, this file's module scope can be reused between requests on a
// "warm" serverless invocation. Caching the connection (and the in-flight
// connection promise) on `global` means we only pay the connect cost once
// per warm instance, instead of on every single request.
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
      })
      .then((mongooseInstance) => {
        console.log("MongoDB Connected");
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Let the next request try again instead of getting stuck on a failed promise
    cached.promise = null;
    console.error("MongoDB Connection Error:", error.message);
    throw error;
  }

  return cached.conn;
};

export default connectDB;