import { errorMessage } from '../../config/config.js';
import bcrypt from 'bcryptjs';
import User from '../../models/user/User.js';
import { object, string } from 'yup';

let userSchema = object({
  firstName: string().required('First name required.'),
  lastName: string().required('Last name required.'),
  email: string().email().required('Email is required.'),
  password: string().required('Password is required.').min(8, 'Password is too short - should be 8 chars minimum.'),
  dateOfBirth: string().required('Date of Birth is required.'),
  registerDate: string(),
  countryCode: string(),
  phone: string().required('Contact Number is required.'),
  emergencyName: string(),
  emergencyContact: string(),
  city: string()
});

let updateUserSchema = object({
  firstName: string().required('First name required.'),
  lastName: string().required('Last name required.'),
  dateOfBirth: string().required('Date of Birth is required.'),
  countryCode: string(),
  phone: string().required('Contact Number is required.'),
  emergencyName: string(),
  emergencyContact: string(),
  city: string()
});

let loginSchema = object({
  email: string().email().required('Email is required.'),
  password: string().required('Password is required.'),
});

let changePasswordSchema = object({
  password: string().required('Password is required.').min(8, 'Password is too short - should be 8 chars minimum.'),
});

export const register = async (req, res) => {
  try {
    await userSchema.validate(req.body);
    let alreadyExist = await User.findOne({email: req.body.email});
    if (alreadyExist) return res.status(400).send({error:'User already exists.'});
    const salt = await bcrypt.genSalt(9);
    const hashPassword = await bcrypt.hash(req.body.password, salt);
    let date = new Date();
    const newUser = await User.create({
      firstName:req.body.firstName,
      lastName:req.body.lastName,
      email: req.body.email,
      password: hashPassword,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      registerDate: date,
      countryCode: req.body.countryCode,
      city:'',
      emergencyName:'',
      emergencyContact:'',
      status:'inactive',
      verifiedPhone: false,
      verifiedEmail: false,
      lastLoginDate: '',
      pictureUrl:'',
    });
    res.status(201).send({message:'User registered'});
  } catch (error) {
    errorMessage(res,error);
  }
};

export const login = async (req, res) => {
  try {
    await loginSchema.validate(req.body);
    const user = await User.findOne({email: req.body.email});
    if (!user) return res.status(404).send({error: 'No account with that email address'});
    if (!user.comparePassword(req.body.password)) return res.status(401).send({error: 'Password incorrect'})
    let date_ob = new Date(); // current date and time (e.g: 2023-03-22T12:44:34.875Z)
    await User.updateOne({_id: user.id}, {$set: {lastLoginDate: date_ob, status: 'active'}}, {new: true});
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
  const { userId } = req.params;
  const { password, confirmPassword } = req.body
  try {
    await changePasswordSchema.validate(req.body);
    let user = await User.findById(userId);
    if(!user) return res.status(404).send({error: 'User does not exist.'});
    if (password !== confirmPassword)
      return res.status(400).send({ error: 'Passwords do not match.' });
    const salt = await bcrypt.genSalt(9);
    const hashPassword = await bcrypt.hash(password, salt);
    const updatedUser = await User.findByIdAndUpdate(userId, { password: hashPassword });
    if (!updatedUser) res.send(500).send({error: 'Something went wrong please try again later.'})
    res.status(201).send({message: 'Password has been reset.'});
  } catch (error) {
    errorMessage(res,error);
  }
}

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
    console.log(users)
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
