import { errorMessage } from '../../config/config.js';
import bcrypt from 'bcrypt';
import User from '../../models/user/User.js';
import { object, string } from 'yup';

let userSchema = object({
  name: string(),
  email: string().email().required('Email is required.'),
  password: string().required('Password is required.'),
  dateOfBirth: string().required('Date of Birth is required.'),
  phone: string().required('Contact Number is required.'),
  emergencyName: string(),
  emergencyContact: string(),
  city: string()
});

export const register = async (req, res) => {
  try {
    await userSchema.validate(req.body);
    let alreadyExist = await User.findOne({email: req.body.email});
    if (alreadyExist) return res.status(400).send({error:'User already exists'});
    let encryptedPassword = await bcrypt.hash(req.body.password, 10);
    await User.create({
      name:'',
      email: req.body.email,
      password: encryptedPassword,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      emergencyName:'',
      emergencyContact:'',
      city:'',
      verifiedPhone: false,
      verifiedEmail: false,
    });
    res.status(201).send({message:'User registered'});
  } catch (error) {
    errorMessage(res,error);
  }
};

export const login = async (req, res) => {
  try {
    let user = await User.findOne({email: req.body.email});
    if (!user) return res.status(404).send({error: 'Email incorrect or user not registerd!'});
    if (!user.comparePassword(req.body.password)) return res.status(401).send({error: 'Password Incorrect!'})
    res.status(200).send({message: 'User Login Successful!'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const forgotPassword = async (req, res) => {
  try {
    let user = await User.findOne({email: req.body.email});
    if (!user) return res.status(404).send({error: 'User is not registerd!'});
    // <---> Email configuration <--->
    res.status(202).send({message: 'Email send with reset link!'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const resetPassword = async (req, res) => {
  try {
    let userID = req.params.id;
    let user = await User.findById(userID);
    if(!user) return res.status(404).send({error: 'User does not exist!'});
    await User.updateOne(
      { _id: userID },
      { $set: {password: await bcrypt.hash(req.body.password, 10)} },
      { new: true }
  );
    res.status(201).send({message: 'Password has been reset!'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteUser = async (req, res) => {
  try {
    let userID = req.params.id;
    let user = await User.findById(userID);
    if(!user) return res.status(404).send({error: 'User does not exist!'});
    await User.deleteOne({user});
    res.status(201).send({message: 'User has been deleted!'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const updateUser = async (req, res) => {
  try {
    let userID = req.params.id;
    let user = await User.findById(userID);
    if(!user) return res.status(404).send({error: 'User does not exist!'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const getAllUsers = async (req, res) => {
  try {
    let users = await User.find();
    res.status(200).send(users);
    console.log(users)
  } catch (error) {
    errorMessage(res,error);
  }
}
