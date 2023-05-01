import mongoose, { Schema } from 'mongoose';

const chatSchema = new Schema(
  {
    title: {
      type: String,
    },
    admins: [{
        _id: {
            type: String,
            required: true,
            trim: true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        profileUrl: {
            type: String,
            trim: true,
        }
    }],
    membersList: [{
        _id: {
            type: String,
            required: true,
            trim: true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        profileUrl: {
            type: String,
            trim: true,
        }
    }],
    creationDate: {
      type: String,
    },
    isPrivate: {
      type: Boolean,
    },
    chatImage: {
      type: String,
    },
    lastMessage: {
      type: Object,
    },
    isDeleted: {
      type: Boolean,
    }
  },
  { timestamps: true }
);

export default mongoose.model('Chat', chatSchema);
