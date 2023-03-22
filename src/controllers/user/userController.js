import { errorMessage } from '../../config/config.js';
import bcrypt from 'bcrypt';
import User from '../../models/user/User.js';
import { object, string } from 'yup';

let userSchema = object({
  name: string(),
  email: string().email().required('Email is required.'),
  password: string().required('Password is required.').min(8, 'Password is too short - should be 8 chars minimum.'),
  dateOfBirth: string().required('Date of Birth is required.'),
  phone: string().required('Contact Number is required.'),
  emergencyName: string(),
  emergencyContact: string(),
  city: string()
});

let loginSchema = object({
  email: string().email().required('Email is required.'),
  password: string().required('Password is required.'),
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
      lastLoginDate: ''
    });
    res.status(201).send({message:'User registered'});
  } catch (error) {
    errorMessage(res,error);
  }
};

export const login = async (req, res) => {
  try {
    await loginSchema.validate(req.body);
    let user = await User.findOne({email: req.body.email});
    if (!user) return res.status(404).send({error: 'No account with that email address'});
    if (!user.comparePassword(req.body.password)) return res.status(401).send({error: 'Password incorrect'})
    let date_ob = new Date(); // current date and time (e.g: 2023-03-22T12:44:34.875Z)
    await User.updateOne({_id: user.id}, {$set: {lastLoginDate: date_ob}}, {new: true});
    // User.findByIdAndUpdate(user.id, {lastLoginDate: date_ob})
    res.status(200).send({
      accessToken: user.generateJWT(7,process.env.ACCESS_TOKEN_SECRET), 
      refreshToken: user.generateJWT(30,process.env.REFRESH_TOKEN_SECRET),
      user});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const forgotPassword = async (req, res) => {
  try {
    let user = await User.findOne({email: req.body.email});
    if (!user) return res.status(404).send({error: 'User is not registerd.'});
    // <---> Email configuration <--->
    res.status(202).send({message: 'Email send with reset link.'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const resetPassword = async (req, res) => {
  try {
    let userID = req.params.id;
    let user = await User.findById(userID);
    if(!user) return res.status(404).send({error: 'User does not exist.'});
    await User.updateOne({_id: userID},{$set: {password: await bcrypt.hash(req.body.password,10)}},{ new: true });
    res.status(201).send({message: 'Password has been reset.'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteUser = async (req, res) => {
  try {
    let userID = req.params.id;
    let user = await User.findById(userID);
    if(!user) return res.status(404).send({error: 'User does not exist.'});
    await User.deleteOne({_id: userID});
    res.status(201).send({message: 'User has been deleted.'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const updateUser = async (req, res) => {
  try {
    let userID = req.params.id;
    let user = await User.findById(userID);
    if(!user) return res.status(404).send({error: 'User does not exist.'});
    await User.updateOne(
      { _id: userID },
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
