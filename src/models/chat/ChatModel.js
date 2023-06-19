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
      default: 'https://cdn.pixabay.com/photo/2017/11/10/05/46/group-2935521_1280.png'
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
