import mongoose, { Schema } from 'mongoose';

const chatMsgSchema = new Schema(
  {
    chatId: {
      type: String,
      trim: true,
    },
    userId: {
      type: String,
      trim: true,
    },
    userName: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('ChatMsg', chatMsgSchema);
