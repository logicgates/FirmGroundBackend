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
    pitches: {
        type: Number,
        trim: true,
    },
    cost: {
        type: Number,
        trim: true,
    }
},
{ timestamps: true }
);

export default mongoose.model('Stadium', stadiumSchema);