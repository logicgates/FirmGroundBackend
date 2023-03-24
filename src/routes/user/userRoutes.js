import express from 'express';
import { register, getAllUsers, login, forgotPassword, resetPassword, deleteUser, updateUser } from '../../controllers/user/userController.js';

const router = express.Router();

router.get('/users', getAllUsers)

router.post('/login', login)

router.post('/register', register);

router.patch('/update/:id', updateUser)

router.post('/forgot-password', forgotPassword);

router.patch('/reset-password/:id', resetPassword);

router.delete('/delete/:id', deleteUser)

export default router;
