import mongoose, { Schema } from 'mongoose';

const userVerificationSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: Schema.ObjectId,
      required: true,
      ref: 'User',
    },
    expireAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('UserVerification', userVerificationSchema);