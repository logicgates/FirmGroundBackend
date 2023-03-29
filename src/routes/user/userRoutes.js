import express from 'express';
import { getUser, getAllUsers, deleteUser, updateUser } from '../../controllers/user/userController.js';
import { 
    register, 
    login, 
    forgotPassword, 
    resetPassword, 
    verifyForgotCode, 
    generateRefreshToken,
    verifyUserRegisteration, 
} from '../../controllers/auth/authController.js';

const router = express.Router();

router.get('/user/:userId', getUser)

router.get('/users', getAllUsers)

router.post('/login', login)

router.post('/register', register);

router.post('/verify-user/:token', verifyUserRegisteration);

router.patch('/update/:userId', updateUser)

router.post('/forgot-password', forgotPassword);

router.post('/verify-code', verifyForgotCode);

router.get('/refresh-token/:refreshToken', generateRefreshToken);

router.patch('/reset-password/:userId', resetPassword);

router.delete('/delete/:userId', deleteUser)

export default router;
