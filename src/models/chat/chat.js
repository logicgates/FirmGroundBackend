import mongoose, { Schema } from 'mongoose';

const chatSchema = new Schema({
    userA: {
        type: String,
        required: true
    },
    userB: {
        type: String,
        required: true
    },
    creationDate: {
        type: String,
    }
})

export default mongoose.model('Chat', chatSchema);