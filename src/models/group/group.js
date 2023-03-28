import mongoose, { Schema } from 'mongoose';

const groupSchema = new Schema({
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
    }
})

export default mongoose.model('Group', groupSchema);