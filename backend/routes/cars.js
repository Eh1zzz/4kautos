import express from "express";
import Car from "../models/Car.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// GET /cars — search/filter
router.get("/", async (req, res) => {
  try {
    const { q, make, model, year, minPrice, maxPrice, condition } = req.query;
    const filter = {};
    if (q)         filter.title   = { $regex: q, $options: "i" };
    if (make)      filter.make    = { $regex: make, $options: "i" };
    if (model)     filter.model   = { $regex: model, $options: "i" };
    if (year)      filter.year    = parseInt(year);
    if (condition) filter.condition = condition;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    const cars = await Car.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("sellerId", "name verified");
    res.json(cars);
  } catch (err) {
    console.error("GET /cars:", err.message);
    res.status(500).json({ message: "Failed to fetch cars" });
  }
});

// GET /cars/:id — details
router.get("/:id", async (req, res) => {
  try {
    const car = await Car.findById(req.params.id).populate("sellerId", "name email verified");
    if (!car) return res.status(404).json({ message: "Car not found" });
    res.json(car);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch car" });
  }
});

// POST /cars — create listing (authenticated sellers)
router.post("/", authenticate, authorize("seller"), async (req, res) => {
  try {
    const car = new Car({ ...req.body, sellerId: req.user.id, photos: req.body.photos || [] });
    await car.save();
    res.status(201).json({ message: "Car added successfully", car });
  } catch (err) {
    console.error("POST /cars:", err.message);
    res.status(500).json({ message: "Failed to add car" });
  }
});

// POST /cars/:id/photos — upload images
router.post("/:id/photos", authenticate, authorize("seller"), upload.array("photos", 10), async (req, res) => {
  try {
    const car = await Car.findOne({ _id: req.params.id, sellerId: req.user.id });
    if (!car) return res.status(404).json({ message: "Car not found" });
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    car.photos.push(...urls);
    await car.save();
    res.json({ message: "Photos uploaded", photos: car.photos });
  } catch (err) {
    res.status(500).json({ message: "Failed to upload photos" });
  }
});

// DELETE /cars/:id — admin only
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: "Car deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete car" });
  }
});

export default router;
