import express from 'express';
import {
  getUser,
  getUsersList,
  deleteUser,
  updateUser,
  changePassword,
} from '../../controllers/user/userController.js';
import {
  registerAndSendCode,
  login,
  sendForgotCode,
  resetPassword,
  verifyForgotCode,
  generateRefreshToken,
  verifyUserRegisteration,
  socialAccountLogin,
  resendVerifyForgotCode,
  resendRegisterCode,
} from '../../controllers/auth/authController.js';
import { upload } from '../../config/multerConfig.js';
import User from '../../models/user/User.js';

async function checkUserSession (req, res, next) {
  const userId = req.session.userInfo?.userId;
  const user = await User.findOne({ _id: userId });
  if (!user)
      return res
          .status(401)
          .send({ error: 'User timeout. Please login again.' });
  if (user.deleted?.isDeleted)
      return res
          .status(404)
          .send({ error: 'Not allowed' });
  
  const userInfo = {
      userId: user._id.toString(),
      email: user.email,
      profileImage: user.profileImage,
      deviceId: user.deviceId
  }
  req.userInfo = userInfo;
  next();
}

const router = express.Router();

router.get('/user/:userId', checkUserSession, getUser);
router.get('/users-list', checkUserSession, getUsersList)
router.post('/change-password/:userId', checkUserSession, changePassword);
router.put('/update/:userId', checkUserSession, upload.single('image'), updateUser);
router.delete('/delete/:userId', checkUserSession, deleteUser);

router.post('/login', login);
router.post('/register', registerAndSendCode);
router.post('/resend-register-code', resendRegisterCode);
router.post('/social-login', socialAccountLogin);
router.post('/verify-email/:token', verifyUserRegisteration);
router.post('/forgot-password', sendForgotCode);
router.post('/resend-verify-code', resendVerifyForgotCode);
router.post('/verify-code', verifyForgotCode);
router.post('/refresh-token/:refreshToken', generateRefreshToken);
router.put('/reset-password/:token', resetPassword);

export default router;
