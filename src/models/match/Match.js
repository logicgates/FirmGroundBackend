import mongoose, { Schema } from 'mongoose';

const matchSchema = new Schema({
    groupId: {
        type: String,
    },
    players: [{
        playerId: {
            type: String,
            required: true
        },
        participationStatus: {
            type: String,
            required: true
        }
    }],
    teamA: { // List of members' id in team A
        type: Array,
    },
    teamB: { // List of members' id in team B
        type: Array,
    },
    title: {
        type: String,
    },
    location: { // Stadium
        type: String,
    },
    pictureUrl: {
        type: String,
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
    },
    creationDate: {
        type: String,
    }
})

export default mongoose.model('Match', matchSchema);