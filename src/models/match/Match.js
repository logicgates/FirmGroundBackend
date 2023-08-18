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
        parentId: {
            type: String,
            default: null,
        },
        info: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        participationStatus: {
            type: String,
            required: true,
        },
        isActive: {
            type: Boolean,
            required: true,
        },
        payment: {
            type: String,
        },
        team: {
            type: String,
            default: ''
        },
        addition: {
            type: Number,
        },
        number: {
            type: Number,
            default: 0
        }
    }],
    maxPlayers: {
        type: Number,
        default: 22
    },
    inPlayerCount: {
        type: Number,
        default: 0
    },
    title: {
        type: String,
        trim: true,
    },
    stadiumId: {
        type: String,
        trim: true,
    },
    location: {
        type: String,
        trim: true,
    },
    pictureUrl: {
        type: String,
        trim: true,
    },
    type: {
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
        default: 'red',
        trim: true,
    },
    teamBColor: {
        type: String,
        default: 'blue',
        trim: true,
    },
    referee: {
        type: Boolean,
        default: false
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
        default: false,
        trim: true,
    },
    creationDate: {
        type: String,
    },
    lockTimer: {
        type: String,
        default: '0',
    },
    isLocked: {
        type: Boolean,
        default: false,
    },
    isCompleted: {
        type: Boolean,
        default: false,
    },
    isCancelled: {
        type: Boolean,
        default: false,
    },
    deleted: {
        isDeleted: {
            type: Boolean,
            default: false,
        },
        date: {
            type: Date,
            default: null,
        },
    },
    },
    { timestamps: true }
);

matchSchema.methods.updatePlayerCount = async function () {
    const match = this;
    const playerCount = match.players.filter((player) => (player.participationStatus === 'in')).length;
    match.inPlayerCount = playerCount;
    await match.save();
};

matchSchema.methods.isOpenForPlayers = function () {
    const match = this;
    if (!match.isLocked) {
        const matchDateTime = moment(`${match.date} ${match.meetTime}`, 'DD-MM-YYYY hh:mm A');
        const currentDateTime = moment();
        return currentDateTime.isBefore(matchDateTime);
    } else {
        return false;
    }
};

matchSchema.methods.updateLockTimer = async function() {
    const match = this;
    if (!match.isCompleted) {
        const matchDuration = parseInt(match.duration);
        const currentTime = moment();
        const kickOffTime = moment(`${match.date} ${match.kickOff}`, 'DD-MM-YYYY hh:mm A');
        if (match.isCancelled) {
            match.lockTimer = 0;
        }
        else if (match.isLocked && kickOffTime.isBefore(currentTime.add(matchDuration, 'minutes'))) {
            match.isCompleted = true;
        }
        else if (!match.isLocked && kickOffTime.isBefore(currentTime.add(48, 'hours'))) {
            match.isLocked = true;
            match.lockTimer = 0;
        }
        else {
            // const lockTimeRemaining = Math.ceil(kickOffTime.diff(currentTime, 'minutes'));
            const lockTimeRemaining = moment.duration(kickOffTime.diff(currentTime));
            const days = lockTimeRemaining.days();
            const hours = lockTimeRemaining.hours();
            const minutes = lockTimeRemaining.minutes();
            let lockTimerString = '';
            if (days > 0) {
                lockTimerString += `${days} days `;
            }
            lockTimerString += `${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
            match.isLocked = false;
            match.lockTimer = lockTimerString;
        }
        await match.save();
    }
};

matchSchema.methods.updatePaymentCollected = async function() {
    const match = this;
    const matchPlayers = match.players.filter(player =>
        player.participationStatus === 'in' || player.participationStatus === 'pending'
    );
    match.cost = match.costPerPerson * matchPlayers.length; // Total cost
    const paidPlayers = match.players.filter(
        (player) => player.payment === 'paid'
    );
    const numPaidPlayers = paidPlayers.length;
    match.collected = match.costPerPerson * numPaidPlayers; // Collected amount
    await match.save();
};

export default mongoose.model('Match', matchSchema);