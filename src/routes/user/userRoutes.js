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
  forgotPassword,
  resetPassword,
  verifyForgotCode,
  generateRefreshToken,
  verifyUserRegisteration,
  socialAccountLogin,
  resendVerifyForgotCode,
} from '../../controllers/auth/authController.js';

const router = express.Router();

router.get('/user/:userId', getUser);
router.post('/change-password/:userId', changePassword);
router.patch('/update/:userId', updateUser);
router.delete('/delete/:userId', deleteUser);

router.post('/login', login);
router.post('/register', register);
router.post('/social-login', socialAccountLogin);
router.post('/verify-user/:token', verifyUserRegisteration);
router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyForgotCode);
router.post('/resend-verify-code', resendVerifyForgotCode);
router.get('/refresh-token/:refreshToken', generateRefreshToken);
router.patch('/reset-password/:token', resetPassword);

export default router;
