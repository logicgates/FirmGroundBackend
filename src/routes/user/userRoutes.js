import express from 'express';
import {
  getUser,
  deleteUser,
  updateUser,
  changePassword,
} from '../../controllers/user/userController.js';
import {
  register,
  login,
  sendForgotCode,
  resetPassword,
  verifyOtpCode,
  generateRefreshToken,
  verifyUserRegisteration,
  socialAccountLogin,
  resendVerifyForgotCode,
  resendRegisterCode,
} from '../../controllers/auth/authController.js';

const router = express.Router();

router.get('/user/:userId', getUser);
router.post('/change-password/:userId', changePassword);
router.patch('/update/:userId', updateUser);
router.delete('/delete/:userId', deleteUser);

router.post('/login', login);
router.post('/register', register);
router.post('/resend-register-code', resendRegisterCode);
router.post('/social-login', socialAccountLogin);
router.post('/verify-email/:token', verifyUserRegisteration);
router.post('/forgot-password', sendForgotCode);
router.post('/verify-code', verifyOtpCode);
router.post('/resend-verify-code', resendVerifyForgotCode);
router.get('/refresh-token/:refreshToken', generateRefreshToken);
router.patch('/reset-password/:token', resetPassword);

export default router;
