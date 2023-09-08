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
    trim: true,
  },
  email: {
    type: String,
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
    trim: true,
  },
  registerMethod: {
    type: String,
    require: true,
    default: 'email',
    trim: true,
    enum: ['email', 'facebook', 'google', 'apple'],
  },
  facebookId: {
    type: String,
    trim: true,
  },
  dateOfBirth: {
    type: String,
    trim: true,
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
  blocked: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  deleted: {
    isDeleted: {
      type: Boolean,
      default: false,
    },
    date: {
      type: Date,
      default: null,
    },
    email: {
      type: String,
      default: ''
    }
  },
}, { timestamps: true });

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

export default mongoose.model('User', userSchema);
