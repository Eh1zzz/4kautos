import express     from "express";
import User        from "../models/User.js";
import Car         from "../models/Car.js";
import Transaction from "../models/Transaction.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate, authorize("admin"));

router.get("/users",                        async (_req, res) => { try { res.json(await User.find().select("-password")); } catch { res.status(500).json({ message: "Failed" }); }});
router.patch("/users/:id/verify",           async (req,  res) => { try { const u = await User.findByIdAndUpdate(req.params.id, { verified: true }, { new: true }); res.json({ message: "Verified", user: u }); } catch { res.status(500).json({ message: "Failed" }); }});
router.get("/cars",                         async (_req, res) => { try { res.json(await Car.find().populate("sellerId","name email")); } catch { res.status(500).json({ message: "Failed" }); }});
router.delete("/cars/:id",                  async (req,  res) => { try { await Car.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch { res.status(500).json({ message: "Failed" }); }});
router.get("/transactions",                 async (_req, res) => { try { res.json(await Transaction.find().populate("buyerId","name email").populate("sellerId","name email").populate("carId","title price")); } catch { res.status(500).json({ message: "Failed" }); }});
router.patch("/transactions/:id/dispute",   async (req,  res) => { try { const t = await Transaction.findByIdAndUpdate(req.params.id, { status: "disputed" }, { new: true }); res.json({ message: "Disputed", transaction: t }); } catch { res.status(500).json({ message: "Failed" }); }});

export default router;
