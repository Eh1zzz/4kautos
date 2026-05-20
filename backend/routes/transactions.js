import express     from "express";
import Transaction from "../models/Transaction.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// POST /transactions — buyer initiates
router.post("/", authenticate, authorize("buyer"), async (req, res) => {
  try {
    const { carId, sellerId } = req.body;
    const transaction = new Transaction({ buyerId: req.user.id, sellerId, carId, status: "initiated" });
    await transaction.save();
    res.status(201).json({ message: "Transaction initiated", transaction });
  } catch (err) {
    res.status(500).json({ message: "Failed to initiate transaction" });
  }
});

// GET /transactions — authenticated user's transactions
router.get("/", authenticate, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ buyerId: req.user.id }, { sellerId: req.user.id }]
    })
      .populate("buyerId",  "name")
      .populate("sellerId", "name")
      .populate("carId",    "title price");
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

// GET /transactions/:id — details
router.get("/:id", authenticate, async (req, res) => {
  try {
    const t = await Transaction.findById(req.params.id)
      .populate("buyerId",  "name email")
      .populate("sellerId", "name email")
      .populate("carId",    "title price");
    if (!t) return res.status(404).json({ message: "Transaction not found" });
    res.json(t);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transaction" });
  }
});

// PATCH /transactions/:id/status — buyer or seller updates status
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const t = await Transaction.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Transaction not found" });
    if (![t.buyerId.toString(), t.sellerId.toString()].includes(req.user.id))
      return res.status(403).json({ message: "Not authorized" });
    t.status = status;
    await t.save();
    res.json({ message: "Transaction updated", transaction: t });
  } catch (err) {
    res.status(500).json({ message: "Failed to update transaction" });
  }
});

export default router;
