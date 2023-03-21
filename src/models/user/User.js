import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  name: {
    type: String,
    require: true,
  },
});

export default mongoose.model('User', userSchema);
