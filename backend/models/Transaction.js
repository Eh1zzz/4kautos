import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  buyerId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  carId:    { type: mongoose.Schema.Types.ObjectId, ref: "Car",  required: true },
  status: {
    type: String,
    enum: ["initiated","pending_inspection","payment_in_escrow","completed","cancelled","disputed"],
    default: "initiated"
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Transaction", transactionSchema);
