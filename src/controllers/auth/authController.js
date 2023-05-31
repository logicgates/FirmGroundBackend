import { errorMessage, generateRandomString } from '../../config/config.js';
import UserVerification from '../../models/UserVerification/UserVerification.js';
import { s3Client } from '../../config/awsConfig.js';
import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  resendVerifySchema,
  verifyCodeSchema,
  verifyUserRegisterationSchema,
  socialRegisterSchema
} from '../../schema/user/userSchema.js'
import User from '../../models/user/User.js';
import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const bucketName = process.env.S3_BUCKET_NAME;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const mailAddress = 'myfirmground@gmail.com';

export const login = async (req, res) => {
  try {
    await loginSchema.validate(req.body);
    const user = await User.findOne({email: req.body?.email});
    if (!user) 
      return res
        .status(404)
        .send({ error: 'This email is not registered.' });
    if (!user.isActive)
      return res
        .status(403)
        .send({ error: 'Email is not verified.' });
    if (!user.comparePassword(req.body?.password))
      return res
        .status(401)
        .send({ error: 'Password is incorrect.' });
    if (user.deleted?.isDeleted)
      return res
        .status(401)
        .send({ error: 'Account is deactivated. Kindly re-verify to login.' });
    let currentLoginDate = new Date(); // current date and time (e.g: 2023-03-22T12:44:34.875Z)
    const sessionUser = { userId: user?._id, email: user?.email };
    req.session.userInfo = sessionUser;
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
      user: { ...user?._doc, lastLoginAt: currentLoginDate, isActive: true },});
  } catch (error) {
    errorMessage(res,error);
  }
};

export const registerAndSendCode = async (req, res) => {
  try {
    await registerSchema.validate(req.body);
    let emailExist = await User.findOne({email: req.body.email});
    if (emailExist) {
      if (!emailExist.isActive)
        return res
          .status(403)
          .send({ error: 'Account already registered but not verified.' });
      return res
        .status(404)
        .send({ error: 'This email is already in use.' });
    }
    let phoneExist = await User.findOne({phone: req.body.phone});
    if (phoneExist)
      return res
        .status(404)
        .send({ error: 'This phone number is already in use.' });
    const salt = await bcrypt.genSalt(9);
    const hashPassword = await bcrypt.hash(req.body.password, salt);
    let currentDate = new Date();
    const user = await User.create({
      ...req.body,
      password: hashPassword,
      city:'',
      emergencyName:'',
      emergencyContact:'',
      status: false,
      lastLoginDate: '',
      registerDate: currentDate,
      deleted: {}
    });
    let verificationCode = generateRandomString(6).toUpperCase();
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
      fullName: "FirmGround",
      from: mailAddress,
      template_id: process.env.SENDGRID_TEM_ID_FOR_VERIFY_EMAIL,
      personalizations: [
        {
          to: { email: `${user?._doc?.email}` },
          dynamic_template_data: {
            subject: 'verification Email Email',
            name: user?._doc?.firstName,
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
            'Your account has been created and a verification email has been sent. ' +
            'Please check your email and verify your account.',
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

export const resendRegisterCode = async (req, res) => {
  try {
    await resendVerifySchema.validate(req.body);
    const user = await User.findOne({ email: req.body?.email }).exec();
    if (!user)
      return res
        .status(404)
        .send({ error: 'This email is not registered.' });
    let verificationCode = generateRandomString(6).toUpperCase();
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
      fullName: "FirmGround",
      from: mailAddress,
      template_id: process.env.SENDGRID_TEM_ID_FOR_VERIFY_EMAIL,
      personalizations: [
        {
          to: { email: `${user?._doc?.email}` },
          dynamic_template_data: {
            subject: 'verification Email Email',
            name: user?._doc?.firstName,
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
            'Your account has been created and a verification email has been sent. ' +
            'Please check your email and verify your account.',
          verifyToken,
        });
      })
      .catch((error) => {
        res.status(401).send({ error: error });
      });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const verifyUserRegisteration = async (req, res) => {
  const { token } = req.params;
  if (!token)
    return res
      .status(407)
      .send({ error: 'Proxy Authentication Required.' });
  try {
    const currentLoginDate = new Date();
    await verifyUserRegisterationSchema.validate(req.body);
    const { userId, code, email } = await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );
    if (code !== req.body?.code)
      return res.status(400).send({
        message: 'Invalid verificaiton code.',
      });
    const user = await User.findOne({ _id: userId, email }, '-deleted -__v');
    if (!user)
      return res.status(404).send({
        message: 'This account was not found.',
      });
    if (user?._doc?.isActive)
      return res.status(400).send({
        message: 'Your account is already verified.',
      });
    const sessionUser = { userId: user?._id, email: user?.email };
    req.session.userInfo = sessionUser;
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
    await User.findByIdAndUpdate(user?._id, {
      lastLoginDate: currentLoginDate,
      isActive: true,
    });
    res.status(200).send({
      user: { ...user?._doc, lastLoginDate: currentLoginDate, isActive: true },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const sendForgotCode = async (req, res) => {
  try {
    await resendVerifySchema.validate(req.body);
    let user = await User.findOne({email: req.body?.email});
    if (!user)
      return res
        .status(404)
        .send({ error: 'This email is not registered.' });
    if (!user.isActive)
      return res
        .status(403)
        .send({ error: 'Email is not verified.' });
    let verificationCode = generateRandomString(6).toUpperCase();
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
      fullName: "FirmGround",
      from: mailAddress,
      template_id: process.env.SENDGRID_TEM_ID_FOR_FORGOT_PASSWORD,
      personalizations: [
        {
          to: { email: `${user.email}` },
          dynamic_template_data: {
            fullName: "FirmGround",
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
  } catch (error) {
    errorMessage(res,error);
  }
};

export const resendVerifyForgotCode = async (req, res) => {
  try {
    await resendVerifySchema.validate(req.body);
    const user = await User.findOne({ email: req.body?.email }).exec();
    if (!user)
      return res
        .status(404)
        .send({ error: 'This email is not registered.' });
    await UserVerification.deleteMany({ userId: user?._id });
    let verificationCode = generateRandomString(6).toUpperCase();
    const salt = await bcrypt.genSalt(9);
    const hashCode = await bcrypt.hash(verificationCode, salt);
    const userVerification = await UserVerification.create({
      code: hashCode,
      userId: user?._id,
      expireAt: Date.now() + 18000000, //Expire in 5 minutes
    });
    if (!userVerification)
      return res
        .status(500)
        .send({ error: 'Something went wrong please try again later.' });
    const msg = {
      fullName: "FirmGround",
      from: mailAddress,
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
          userId: user?._id,
          email: req.body?.email,
          codeHash: hashCode,
        });
      })
      .catch((error) => {
        res.status(401).send({ error: error });
      });
  } catch (error) {
    errorMessage(res, error);
  }
};

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
      process.env.ACCESS_TOKEN_SECRET,
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
    await resetPasswordSchema.validate(req.body);
    const { userId } = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (!userId) 
      return res
        .status(401)
        .send({ error: 'Token is not valid.' });
    const salt = await bcrypt.genSalt(9);
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

export const socialAccountLogin = async (req, res) => {
  try {
    const currentLoginDate = new Date();
    await socialRegisterSchema.validate(req.body);
    let user;
    if (req.body.registerMethod === 'facebook' && !req.body?.email) {
      if (!req.body?.facebookId)
        return res
          .status(400)
          .send({ error: 'Facebook user id is required.' });
      user = await User.findOne({ facebookId: req.body?.facebookId });
      if (!user && !req.body?.email)
        return res
          .status(400)
          .send({
            error: 'Email is required.',
            emailRequired: true,
            firstName: req.body?.firstName,
            lastName: req.body?.lastName,
            facebookId: req.body?.facebookId,
            profileImage: req.body?.profileImage,
          });
    } else {
      if (!req.body?.email)
        return res
          .status(400)
          .send({ error: 'Email is required.' });
      user = await User.findOne({ email: req.body?.email });
      if (req.body.registerMethod === 'facebook' && req.body?.facebookId)
        user = await User.findByIdAndUpdate(user?._doc?._id, {
          facebookId: req.body?.facebookId,
        });
    }
    let accessToken;
    let refreshToken;
    if (user) {
      const sessionUser = {
        userId: user?.id,
        email: user?.email,
        registerMethod: user?.registerMethod,
      };
      req.session.userInfo = sessionUser;
      accessToken = await jwt.sign(
        { user: sessionUser },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1d', algorithm: 'HS512' }
      );
      refreshToken = await jwt.sign(
        { user: sessionUser },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d', algorithm: 'HS512' }
      );
    } else {
      const fileName = crypto.randomBytes(32).toString('hex');
      const response = await axios.get(req.body?.profileImage, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(response.data, 'utf-8');
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `profile/${fileName}`,
        Body: buffer,
      });
      s3Client.send(command);
      user = await User.create({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        profileImage: `${process.env.S3_BUCKET_ACCESS_URL}profile/${fileName}`,
        registerMethod: req.body?.registerMethod,
        lastLoginAt: currentLoginDate,
      });
      if (!user)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      user.profileImage = req.body?.profileImage;
      const sessionUser = {
        userId: user?._id,
        email: user?.email,
      };
      req.session.userInfo = sessionUser;
      accessToken = await jwt.sign(
        { user: sessionUser },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1d', algorithm: 'HS512' }
      );
      refreshToken = await jwt.sign(
        { user: sessionUser },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '30d', algorithm: 'HS512' }
      );
    }
    res.status(200).send({
      user: { ...user?._doc, deleted: null },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    errorMessage(res, error);
  }
};
