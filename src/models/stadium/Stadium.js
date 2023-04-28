import mongoose, { Schema } from 'mongoose';

const stadiumSchema = new Schema({
    name: {
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
    pitches: [{
        _id: {
            type: String,
            trim: true,
        },
        pitchNo: {
            type: Number,
            trim: true,
        },
        turf: {
            type: String,
            trim: true,
        },
        boots: {
            type: String,
            trim: true
        },
        condition: {
            type: String,
            trim: true
        }
    }],
},
{ timestamps: true }
);

export default mongoose.model('Stadium', stadiumSchema);