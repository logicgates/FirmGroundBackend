import mongoose, { Schema } from 'mongoose';

const matchSchema = new Schema({
    userList: {
        type: String,
    },
    teamAId: {
        type: String,
    },
    teamBId: {
        type: String,
    },
    title: {
        type: String,
    },
    location: {
        type: String,
    },
    pictureUrl: {
        type: URL,
    },
    stadium: {
        type: String,
    },
    date: {
        type: String,
    },
    time: {
        type: String,
    },
    shift: {
        type: String,
    },
    pitchNo: {
        type: String,
    },
    teamAColor: {
        type: String,
    },
    teamBColor: {
        type: String,
    },
    turf: {
        type: String,
    },
    boots: {
        type: String,
    },
    condition: {
        type: String,
    },
    cost: {
        type: Number,
    },
    isRecurring: {
        type: String,
    },
    status: {
        type: String,
    },
    amountCollected: {
        type: Number,
    }
})

export default mongoose.model('Match', matchSchema);