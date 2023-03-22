import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    require: true,
  },
  password: {
    type: String,
    require: true,
  },
  phone: {
    type: String,
    require: true,
  },
  dateOfBirth: {
    type: String,
    require: true,
  },
  emergencyName: {
    type: String,
  },
  emergencyContact: {
    type: String,
  },
  city: {
    type: String,
  },
  verifiedPhone: {
    type: Boolean,
  },
  verifiedEmail: {
    type: Boolean,
  }
});

export default mongoose.model('User', userSchema);
