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
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  emergencyName: {
    type: String,
    trim: true,
  },
  emergencyContact: {
    type: String,
    trim: true,
  },
  deviceId: {
    type: String,
    default: '000',
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: false,
    required: true,
  },
  lastLoginDate: {
    type: String,
  },
  profileImage: {
    type: String,
    default: 'https://cdn.pixabay.com/photo/2017/11/10/05/48/user-2935527_1280.png',
    trim: true,
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

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

export default mongoose.model('User', userSchema);
