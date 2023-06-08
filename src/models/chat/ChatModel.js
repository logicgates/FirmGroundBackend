import mongoose, { Schema } from 'mongoose';

const chatSchema = new Schema(
  {
    title: {
      type: String,
    },
    admins: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    membersList: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    creationDate: {
      type: String,
    },
    isPrivate: {
      type: Boolean,
    },
    matchExist: {
      type: Boolean,
      default: false,
    },
    chatImage: {
      type: String,
    },
    deleted: {
      isDeleted: {
        type: Boolean,
        default: false,
      },
      date: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Chat', chatSchema);
