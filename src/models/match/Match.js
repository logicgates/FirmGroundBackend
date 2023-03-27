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
    location: { // Stadium
        type: String,
    },
    pictureUrl: {
        type: URL,
    },
    type: { // Type of match
        type: String,
    },
    date: {
        type: String,
    },
    meetTime: {
        type: String,
    },
    kickOff: {
        type: String,
    },
    duration: {
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
    recurring: {
        type: String,
    },
    status: {
        type: String,
    },
    amountCollected: {
        type: Number,
    },
    referee: {
        type: Boolean,
    }
})

export default mongoose.model('Match', matchSchema);