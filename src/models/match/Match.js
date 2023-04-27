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
        },
        payment: {
            type: String,
        }
    }],
    activePlayers: [{ // Players with participation status as 'in' only
        _id: {
            type: String,
        },
        name: {
            type: String,
        },
        phone: {
            type: String,
        },
        profileUrl: {
            type: String,
        }
    }],
    teamA: [{ // Players with participation status as 'in' only
        _id: {
            type: String,
        },
        name: {
            type: String,
        },
        phone: {
            type: String,
        },
        profileUrl: {
            type: String,
        }
    }],
    teamB: [{ // Players with participation status as 'in' only
        _id: {
            type: String,
        },
        name: {
            type: String,
        },
        phone: {
            type: String,
        },
        profileUrl: {
            type: String,
        }
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
    collected: {
        type: Number,
        trim: true
    },
    recurring: {
        type: String,
        trim: true,
    },
    creationDate: {
        type: String,
    },
    lockTimer: {
        type: Number,
        default: 0,
    },
    isLocked: {
        type: Boolean,
        default: false,
    },
    isCancelled: {
        type: Boolean,
        default: false,
    }
});

matchSchema.methods.isOpenForPlayers = function () {
    const matchDateTime = moment(`${this.date} ${this.meetTime}`, 'DD-MM-YYYY hh:mm A');
    const currentDateTime = moment();
    return currentDateTime.isBefore(matchDateTime);
};

matchSchema.methods.updateLockTimer = async function() {
    const match = this;
    const currentTime = moment();
    const kickOffTime = moment(`${match.date} ${match.kickOff}`, 'DD-MM-YYYY hh:mm A');
    if (match.isCancelled) {
        match.lockTimer = 0;
    }
    else if (kickOffTime.isBefore(currentTime.subtract(72, 'hours'))) {
        match.isLocked = true;
        match.lockTimer = 0;
    }
    else {
        const lockTimeRemaining = Math.ceil(kickOffTime.diff(currentTime, 'minutes'));
        match.isLocked = false;
        match.lockTimer = lockTimeRemaining;
    }
    await match.save();
};

matchSchema.methods.updateCostPerPerson = async function() {
    const match = this;
    const activePlayers = match.players.filter(
        (player) => player.participationStatus === 'in' ||  player.participationStatus === 'pending'
    );
    const numActivePlayers = activePlayers.length;
    const costPerPerson = numActivePlayers > 0 ? match.cost / numActivePlayers : 0;
    match.costPerPerson = costPerPerson.toFixed(1);
    match.collected = costPerPerson*numActivePlayers;
    await match.save();
}

export default mongoose.model('Match', matchSchema);