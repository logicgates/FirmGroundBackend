import mongoose, { Schema } from 'mongoose';

const chatSchema = new Schema({
    title: {
        type: String,
    },
    admins: {
        type: Array,
        required: true
    },
    membersList: {
        type: Array,
        required: true
    },
    creationDate: {
        type: String,
    },
    isPrivate: {
        type: Boolean,
    }
})

export default mongoose.model('Chat', chatSchema);