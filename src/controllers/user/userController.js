import { errorMessage  } from '../../config/config.js';
import User from '../../models/user/User.js';
import { updateUserSchema, changePasswordSchema } from '../../schema/user/userSchema.js'
import { s3Client } from '../../config/awsConfig.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';

const bucketName = process.env.S3_BUCKET_NAME;

export const getUser = async (req, res) => {
  const { userId } = req.params;
  const userInfo = req.session.userInfo;
  if (userId !== userInfo?.userId)
    return res
      .status(401)
      .send({ error: 'You are not authorized for this request.' });
  try {
    const user = await User.findOne({ _id: userId }, '-deleted -__v -password');
    if (!user) 
    return res
      .status(404)
      .send({ error: 'User not found.' });
    res.status(200).send({ user });
  } catch (error) {
    errorMessage(res,error);
  }
};

export const getUsersList = async (req, res) => {
  const userInfo = req.session.userInfo;
  try {
    const users = await User.find({}, 
      'id firstName lastName phone pictureUrl isActive');
    const filteredUsers = users.filter(user => {
      return userInfo?.userId !== user.id && user.isActive === true;
    });
    if (!filteredUsers)
      return res
        .status(404)
        .send({ error: 'No users found.' });
    res.status(200).send({ users: filteredUsers });
  } catch (error) {
    errorMessage(res,error);
  }
};

export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const updateBody = req.body;
  const userInfo = req.session.userInfo;
  if (userId !== userInfo?.userId)
    return res
      .status(401)
      .send({ error: 'You are not authorized for this request.' });
  try {
    await updateUserSchema.validate(req.body);
    const user = await User.findOne({ _id: userId }, '-deleted -__v -password');
    let fileName = '';
    let imageUrl = user.profileImage;
    if (req.file) {
      if (user?._doc?.profileImage) {
        const commandDel = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: `${
            user?.profileImage?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
          }`,
        });
        await s3Client.send(commandDel);
      }
      fileName = crypto.randomBytes(32).toString('hex');
      const fileMimetype = req.file.mimetype.split('/')[1];
      const buffer = await sharp(req.file.buffer)
        .resize({ width: 520, height: 520, fit: 'contain' })
        .toBuffer();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `profile/${fileName}.${fileMimetype}`,
        Body: buffer,
        ContentType: req.file.mimetype,
      });
      await s3Client.send(command);
      imageUrl = `${process.env.S3_BUCKET_ACCESS_URL}profile/${fileName}.${fileMimetype}`;
    }
    const updateUser = await User.findByIdAndUpdate( userId,
      {
        name: updateBody.name,
        phone: updateBody.phone,
        dateOfBirth: updateBody.dateOfBirth,
        emergencyName: updateBody.emergencyName,
        emergencyContact: updateBody.emergencyContact,
        city: updateBody.city,
        profileImage: imageUrl, 
      }, 
      { new: true }
  );
  if (!updateUser)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  res.status(201).send({ user: updateUser, message:'User has been updated.' });
  } catch (error) {
    errorMessage(res,error);
  }
};

export const changePassword = async (req,res) => {
  const { userId } = req.params;
  const userInfo = req.session.userInfo;
  if (userId !== userInfo?.userId)
    return res
      .status(401)
      .send({ error: 'You are not authorized for this request.' });
  try {
    await changePasswordSchema.validate(req.body);
    const { password, oldPassword } = req.body;
    const user = await User.findOne({ _id: userId }, '-deleted -__v');
    if (!user) 
    return res
      .status(404)
      .send({ error: 'User not found.' });
    const checkPassword = await bcrypt.compare(oldPassword, user?.password);
    if (!checkPassword)
      return res
        .status(400)
        .send({ error: 'Old password must need to be valid.' });
    if (password === oldPassword)
      return res
        .status(400)
        .send({
          error: 'New password must be different from the old password.',
        });
    const salt = await bcrypt.genSalt(9);
    const hashPassword = await bcrypt.hash(password, salt);
    const updateUser = await User.findByIdAndUpdate(userId, {password: hashPassword});
    if (!updateUser)
      return res
        .status(500)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ message: 'Your password has been updated.' });
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteUser = async (req, res) => {
  const { userId } = req.params;
  const userInfo = req.session.userInfo;
  if (userId !== userInfo?.userId)
    return res
      .status(401)
      .send({ error: 'You are not authorized for this request.' });
  try {
    const checkProfile = await User.findOne({ _id: userInfo?.userId }, '-deleted -__v -password');
    if (!checkProfile)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    if (checkProfile?._doc?.deleted?.isDeleted)
      return res
        .status(400)
        .send({ error: 'Your profile has already been deleted.' })
    const deleteProfile = await User.findByIdAndDelete(userInfo?.userId);
    if (!deleteProfile)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(410).send({ message: 'Your profile has been deleted.' });
  } catch (error) {
    errorMessage(res,error);
  }
};
