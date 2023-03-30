import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    required: true,
  },
  password: {
    type: String,
    require: true,
    trim: true,
  },
  phone: {
    type: String,
    unique: true,
    required: 'Your phone number is required',
    trim: true,
  },
  registerMethod: {
    type: String,
    require: true,
    trim: true,
    enum: ['email', 'facebook', 'google'],
  },
  facebookId: {
    type: String,
    trim: true,
  },
  dateOfBirth: {
    type: String,
    require: true,
  },
  registerDate: {
    type: String,
  },
  countryCode: {
    type: String,
  },
  city: {
    type: String,
  },
  emergencyName: {
    type: String,
  },
  emergencyContact: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: false,
    required: true,
  },
  lastLoginDate: {
    type: String,
  },
  pictureUrl: {
    type: String,
  }
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

export default mongoose.model('User', userSchema);
