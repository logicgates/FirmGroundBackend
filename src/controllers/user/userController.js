import { errorMessage, generateRandomString  } from '../../config/config.js';
import bcrypt from 'bcryptjs';
import User from '../../models/user/User.js';
import { object, string } from 'yup';

const updateUserSchema = object({
  firstName: string().required('First name required.'),
  lastName: string().required('Last name required.'),
  dateOfBirth: string().required('Date of Birth is required.'),
  countryCode: string(),
  phone: string().required('Contact Number is required.'),
  emergencyName: string(),
  emergencyContact: string(),
  city: string()
});

export const getUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).send({ error: 'User not found.' });
    res.status(200).send({ user });
  } catch (error) {
    errorMessage(res,error);
  }
}

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).send(users);
  } catch (error) {
    errorMessage(res,error);
  }
}

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  try {
    let updateBody = req.body;
    await updateUserSchema.validate(req.body);
    const user = await User.findById(userId);
    if(!user) return res.status(404).send({error: 'User does not exist.'});
    await User.updateOne(
      { _id: userId },
      { $set: {
        name: updateBody.name,
        phone: updateBody.phone,
        dateOfBirth: updateBody.dateOfBirth,
        emergencyName: updateBody.emergencyName,
        emergencyContact: updateBody.emergencyContact,
        city: updateBody.city 
      }
    }, { new: true }
  );
  res.status(201).send({user: user, message:'User has been updated.'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if(!user) return res.status(404).send({error: 'User does not exist.'});
    await User.deleteOne({_id: userId});
    res.status(201).send({message: 'User has been deleted.'});
  } catch (error) {
    errorMessage(res,error);
  }
}
