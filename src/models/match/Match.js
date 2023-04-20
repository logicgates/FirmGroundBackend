import mongoose, { Schema } from 'mongoose';
import moment from 'moment';

const matchSchema = new Schema({
    chatId: {
        type: Schema.ObjectId,
        required: true,
        ref: 'Chat',
    },
    players: [{
        _id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true
        },
        participationStatus: {
            type: String,
            required: true
        }
    }],
    activePlayers: [{ // Players with participation status as 'in' only
        _id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true
        },
        profileUrl: {
            type: String,
            required: true
        }
    }],
    teamA: [{ // Players with participation status as 'in' only
        _id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true
        },
    }],
    teamB: [{ // Players with participation status as 'in' only
        _id: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true
        },
    }],
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
});

matchSchema.methods.isOpenForPlayers = function () {
    const matchDateTime = moment(`${this.date} ${this.meetTime}`, 'DD-MM-YYYY hh:mm A');
    const currentDateTime = moment();
    return currentDateTime.isBefore(matchDateTime);
};

export default mongoose.model('Match', matchSchema);