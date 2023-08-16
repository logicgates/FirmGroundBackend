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

const router = express.Router();

router.get('/user/:userId', getUser);
router.get('/users-list', getUsersList)
router.post('/change-password/:userId', changePassword);
router.put('/update/:userId', upload.single('image'), updateUser);
router.delete('/delete/:userId', deleteUser);

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
