import mongoose, { Schema } from 'mongoose';

const chatSchema = new Schema({
    userId: {
        type: String,
    },
    members: {
        type: [{ type: String }],
    }
})

export default mongoose.model('Chat', chatSchema);