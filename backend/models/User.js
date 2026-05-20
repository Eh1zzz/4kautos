import mongoose from "mongoose";
import bcrypt   from "bcrypt";

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ["buyer","seller","admin"], default: "buyer" },
  verified: { type: Boolean, default: false },
  createdAt:{ type: Date, default: Date.now },
});

// Hash password before save
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain password to hash
userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

// Never expose password in JSON responses
userSchema.set("toJSON", {
  transform: (_doc, ret) => { delete ret.password; return ret; }
});

export default mongoose.model("User", userSchema);
