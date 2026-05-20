import mongoose from "mongoose";

const carSchema = new mongoose.Schema({
  title:       { type: String, trim: true },
  make:        { type: String, trim: true, index: true },
  model:       { type: String, trim: true, index: true },
  year:        { type: Number, min: 1900, max: new Date().getFullYear() + 1 },
  mileage:     { type: Number, min: 0 },
  vin:         { type: String, trim: true },
  condition:   { type: String, enum: ["excellent","good","fair","poor"], default: "good" },
  description: { type: String, trim: true },
  photos:      { type: [String], default: [] },
  price:       { type: Number, min: 0, index: true },
  featured:    { type: Boolean, default: false },
  sellerId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  createdAt:   { type: Date, default: Date.now },
});

// Virtual: computed title fallback
carSchema.virtual("displayTitle").get(function() {
  return this.title || `${this.year || ""} ${this.make || ""} ${this.model || ""}`.trim();
});

// Text search index
carSchema.index({ make: "text", model: "text", title: "text", description: "text" });

export default mongoose.model("Car", carSchema);
