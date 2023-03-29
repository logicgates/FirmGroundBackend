import { errorMessage, generateRandomString } from '../../config/config.js';
import bcrypt from 'bcryptjs';
import User from '../../models/user/User.js';
import UserVerification from '../../models/UserVerification/UserVerification.js';
import { object, string } from 'yup';
import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';

const registerSchema = object({
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

const loginSchema = object({
    email: string().email().required('Email is required.'),
    password: string().required('Password is required.'),
});
  
const changePasswordSchema = object({
  password: string().min(8).max(32).required('Password is required'),
});

const resendVerifySchema = object({
  email: string().email().required('Email is required.'),
})

const verifyCodeSchema = object({
  email: string().required('Email is required.').email('Please enter valid email'),
  userId: string().required('User id is required.'),
  code: string().required('Code is required.'),
  codeHash: string().required('Code hash is required.'),
});

export const register = async (req, res) => {
  try {
    await registerSchema.validate(req.body);
    let alreadyExist = await User.findOne({email: req.body.email});
    if (alreadyExist) return res.status(400).send({error:'User already exists.'});
    const salt = await bcrypt.genSalt(9);
    const hashPassword = await bcrypt.hash(req.body.password, salt);
    let currentLoginDate = new Date();
    const user = await User.create({
      ...req.body,
      password: hashPassword,
      city:'',
      emergencyName:'',
      emergencyContact:'',
      status: false,
      lastLoginDate: currentLoginDate,
      pictureUrl:'',
    });
    let verificationCode = generateRandomString(6);
    const verifyToken = await jwt.sign(
      {
        userId: user?._doc?._id,
        code: verificationCode,
        email: user?._doc?.email,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d', algorithm: 'HS512' }
    );
    const msg = {
      from: 'firmground@gmail.com',
      template_id: process.env.SENDGRID_TEM_ID_FOR_VERIFY_EMAIL,
      personalizations: [
        {
          to: { email: `${user?._doc?.email}` },
          dynamic_template_data: {
            subject: 'verification Email Email',
            name: user?._doc?.name,
            verification_code: `${verificationCode}`,
          },
        },
      ],
    };
    sgMail
      .send(msg)
      .then(() => {
        res.status(200).send({
          message:
            'Your account has been created and we send you a verification email. Please check your email and verify your account.',
          verifyToken,
        });
      })
      .catch((error) => {
        res.status(401).send({ error: error });
      });
  } catch (error) {
    errorMessage(res,error);
  }
};

export const login = async (req, res) => {
  try {
    await loginSchema.validate(req.body);
    const user = await User.findOne({email: req.body?.email});
    if (!user) return res.status(404).send({error: 'No account with that email address'});
    if (!user.comparePassword(req.body?.password)) return res.status(401).send({error: 'Password incorrect'})
    let currentLoginDate = new Date(); // current date and time (e.g: 2023-03-22T12:44:34.875Z)
    const sessionUser = { userId: user?._id, email: user?.email };
    const accessToken = await jwt.sign(
      { user: sessionUser },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '7d', algorithm: 'HS512' }
    );
    const refreshToken = await jwt.sign(
      { user: sessionUser },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d', algorithm: 'HS512' }
    );
    User.findByIdAndUpdate(user?._id, { lastLoginDate: currentLoginDate });
    res.status(200).send({
      accessToken, 
      refreshToken,
      user});
  } catch (error) {
    errorMessage(res,error);
  }
}
  
export const forgotPassword = async (req, res) => {
  try {
    await resendVerifySchema.validate(req.body);
    let user = await User.findOne({email: req.body?.email});
    if (!user) return res.status(404).send({error: 'User is not registerd.'});
    let verificationCode = generateRandomString(6);
    const salt = await bcrypt.genSalt(9);
    const hashCode = await bcrypt.hash(verificationCode, salt);
    const userVerification = await UserVerification.create({
      code: hashCode,
      userId: user._id,
      expireAt: Date.now() + 18000000, //Expire in 5 minutes
    });
    if (!userVerification)
      return res
        .status(500)
        .send({ error: 'Something went wrong please try again later.' });
    const msg = {
      from: 'firmground@gmail.com',
      template_id: process.env.SENDGRID_TEM_ID_FOR_FORGOT_PASSWORD,
      personalizations: [
        {
          to: { email: `${user.email}` },
          dynamic_template_data: {
            subject: 'Forgot Password Email',
            verification_code: `${verificationCode}`,
          },
        },
      ],
    };
    sgMail
      .send(msg)
      .then(() => {
        res.status(200).send({
          message: 'Forgot Password Email is sent. Please check your email.',
          userId: user._id,
          email: req.body.email,
          codeHash: hashCode,
        });
      })
      .catch((error) => {
        res.status(401).send({ error: error });
      });
    res.status(202).send({message: 'Email sent with reset link.'});
  } catch (error) {
    errorMessage(res,error);
  }
}

export const verifyForgotCode = async (req, res) => {
  try {
    await verifyCodeSchema.validate(req.body);
    const userVerification = await UserVerification.findOne({
      userId: req.body?.userId,
      code: req.body?.codeHash,
    }).exec();
    if (!userVerification)
      return res.status(404).send({
        error:
          'Invalid code or seems to be expired. Please try again with the new verification code.',
      });
    const verifyCode = await bcrypt.compare(
      req.body?.code,
      userVerification?.code
    );
    if (!verifyCode)
      return res.status(401).send({ error: 'Invalid verification code.' });
    UserVerification.deleteMany({ userId: req.body?.userId });
    const token = await jwt.sign(
      {
        userId: req.body?.userId,
      },
      process.env.HASH_ACCESS_KEY,
      { expiresIn: '1h' }
    );
    res.status(200).send({
      message: 'Verification code has been verified.',
      token,
    });
  } catch (error) {
    errorMessage(res, error);
  }
};
  
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(401).send({ error: 'Token is not valid.' });
  try {
    await changePasswordSchema.validate(req.body);
    const { userId } = await jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    if (!userId) return res.status(401).send({ error: 'Token is not valid.' });
    const salt = await bcrypt.genSalt(5);
    const password = await bcrypt.hash(req.body?.password, salt);
    const updatedUser = await User.findByIdAndUpdate(userId, {
      password: password,
    });
    if (!updatedUser)
      return res
        .status(500)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({
      message: 'Password has beed changed. Please login with new password.',
    });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const generateRefreshToken = async (req, res) => {
  const { refreshToken } = req.params;
  try {
    const { user } = await jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    if (!user?.email || !user?.userId)
      return res.status(401).send({ error: 'Token is not valid.' });
    const userInfo = await User.findOne({
      email: user?.email,
      _id: user?.userId,
    }).exec();
    const newAccessToken = await jwt.sign(
      {
        user: { userId: userInfo?.id, email: userInfo?.email },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '7d', algorithm: 'HS512' }
    );
    const newRefreshToken = await jwt.sign(
      {
        user: { userId: userInfo?._id, email: userInfo?.email },
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d', algorithm: 'HS512' }
    );
    res.status(200).send({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const verifyUserRegisteration = async (req, res) => {
  const { token } = req.params;
  try {
    const currentLoginDate = new Date();
    await verifyUserRegisterationSchema.validate(req.body);
    const { userId, code, email } = await jwt.verify(
      token,
      process.env.HASH_ACCESS_KEY
    );
    if (code !== req.body?.code)
      return res.status(400).send({
        message: 'Invalid verificaiton code.',
      });
    const user = await User.findOne({ _id: userId, email }, '-deleted -__v');
    if (!user)
      return res.status(404).send({
        message: 'Your account not found.',
      });
    if (user?._doc?.isActive)
      return res.status(400).send({
        message: 'Your account already verified.',
      });
    const sessionUser = { userId: user?._id, email: user?.email };
    req.session.userInfo = sessionUser;
    const accessToken = await jwt.sign(
      { user: sessionUser },
      process.env.HASH_ACCESS_KEY,
      { expiresIn: '7d', algorithm: 'HS512' }
    );
    const refreshToken = await jwt.sign(
      { user: sessionUser },
      process.env.HASH_SECRET_KEY,
      { expiresIn: '30d', algorithm: 'HS512' }
    );
    await User.findByIdAndUpdate(user?._id, {
      lastLoginAt: currentLoginDate,
      isActive: true,
    });
    res.status(200).send({
      user: { ...user?._doc, lastLoginAt: currentLoginDate, isActive: true },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    errorMessage(res, error);
  }
};
