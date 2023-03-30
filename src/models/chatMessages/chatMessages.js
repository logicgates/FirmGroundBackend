import mongoose, { Schema } from 'mongoose';

const chatMsgSchema = new Schema({
    chatId: {
        type: String,
    },
    userId: {
        type: String,
    },
    message: {
        type: String,
    },
    timestamp: {
        type: String,
    }
})

export default mongoose.model('ChatMsg', chatMsgSchema);