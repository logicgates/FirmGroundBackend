import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
    required: 'Your email is required',
  },
  password: {
    type: String,
    require: true,
  },
  phone: {
    type: String,
    unique: true,
    required: 'Your phone number is required',
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
  },
  lastLoginDate: {
    type: Boolean,
  }
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compareSync(password, this.password);
};

userSchema.methods.generateJWT = function (NumberOfDays, key) {
  const today = new Date();
  const expirationDate = new Date(today);
  expirationDate.setDate(today.getDate() + NumberOfDays); // Expires after 7 days

  let payload = {
      id: this._id,
      email: this.email,
      phone: this.phone,
      name: this.name,
  };

  return jwt.sign(payload, key, {
      expiresIn: parseInt(expirationDate.getTime() / 1000, 10)
  });
};

export default mongoose.model('User', userSchema);
