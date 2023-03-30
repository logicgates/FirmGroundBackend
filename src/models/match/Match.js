import mongoose, { Schema } from 'mongoose';

const matchSchema = new Schema({
    groupId: {
        type: Schema.ObjectId,
        required: true,
        ref: 'Chat',
    },
    players: [{
        playerId: {
            type: Schema.ObjectId,
            required: true,
            ref: 'User',
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
        trim: true,
    },
    location: { // Stadium
        type: String,
        trim: true,
    },
    pictureUrl: {
        type: String,
        trim: true,
    },
    type: { // Type of match
        type: String,
        trim: true,
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
        trim: true,
    },
    pitchNumber: {
        type: String,
        trim: true,
    },
    teamAColor: {
        type: String,
        trim: true,
    },
    teamBColor: {
        type: String,
        trim: true,
    },
    referee: {
        type: Boolean,
    },
    turf: {
        type: String,
        trim: true,
    },
    boots: {
        type: String,
        trim: true,
    },
    condition: {
        type: String,
        trim: true,
    },
    cost: {
        type: Number,
        trim: true,
    },
    costPerPerson: {
        type: Number,
        trim: true,
    },
    recurring: {
        type: String,
        trim: true,
    },
    creationDate: {
        type: String,
    }
})

export default mongoose.model('Match', matchSchema);