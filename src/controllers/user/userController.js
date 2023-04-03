import { errorMessage  } from '../../config/config.js';
import User from '../../models/user/User.js';
import { object, string } from 'yup';

const updateUserSchema = object({
  firstName: string().required('First name required.'),
  lastName: string().required('Last name required.'),
  dateOfBirth: string().required('Date of Birth is required.'),
  countryCode: string(),
  emergencyName: string(),
  emergencyContact: string(),
  city: string()
});

const changePasswordSchema = object({
  oldPassword: string().required('Old password is required'),
  password: string().min(8).max(32).required('Password is required'),
});

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
      'firstName lastName phone pictureUrl');
    const filteredUsers = users.filter(user=> userInfo?.userId !== user._id);
    if (!filteredUsers) return res.status(404).send({ error: 'No users found.' });
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
    const updateUser = await User.updateOne(
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
  if (!updateUser)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  const user = await User.findById(userId);
  res.status(201).send({ user: user, message:'User has been updated.' });
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
  const userInfo = req.session.userInfo;
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
    const deleteProfile = await User.findByIdAndUpdate(user?.userId, {
      deleted: { isDeleted: true, date: new Date() },
    });
    if (!deleteProfile)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(410).send({ message: 'Your profile has been deleted.' });
  } catch (error) {
    errorMessage(res,error);
  }
};
