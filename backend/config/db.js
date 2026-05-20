import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_DB_URI;
  if (!uri) throw new Error("MONGO_DB_URI is not defined in environment");

  mongoose.connection.on("connected", () => console.log("✅ MongoDB connected"));
  mongoose.connection.on("error",     (e) => console.error("MongoDB error:", e));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected — retrying…"));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
}
