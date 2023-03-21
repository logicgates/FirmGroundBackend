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
      city:''
    });
    res.status(201).send({message:'User registered'});
  } catch (error) {
    errorMessage(res,error);
  }
};

export const login = async (req, res) => {
  try {
    let user = await User.findOne({email: req.body.email});
    if (!user) return res.status(404).send({error: 'User is not registerd!'});
    const comparePasswords = await bcrypt.compare(req.body.password, user.password);
    if(!comparePasswords) return res.status(401).send({error: 'Username/Password Incorrect!'})
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

export const getAllUsers = async (req, res) => {
  try {
    let users = await User.find();
    res.status(200).send(users);
    console.log(users)
  } catch (error) {
    errorMessage(res,error);
  }
}
