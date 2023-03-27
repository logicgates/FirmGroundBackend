import express from 'express';
import { register, getAllUsers, login, forgotPassword, resetPassword, deleteUser, updateUser, getUser } from '../../controllers/user/userController.js';

const router = express.Router();

router.get('/user/:userId', getUser)

router.get('/users', getAllUsers)

router.post('/login', login)

router.post('/register', register);

router.patch('/update/:userId', updateUser)

router.post('/forgot-password', forgotPassword);

router.patch('/reset-password/:userId', resetPassword);

router.delete('/delete/:userId', deleteUser)

export default router;
