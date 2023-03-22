import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';

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

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

export default mongoose.model('User', userSchema);
