import express from 'express';
import { register, getAllUsers, login, forgotPassword, resetPassword, deleteUser } from '../../controllers/user/userController.js';

const router = express.Router();

router.get('/users', getAllUsers)

router.post('/login', login)

router.post('/register', register);

router.post('/forgot-password', forgotPassword);

router.patch('/reset-password/:id', resetPassword);

router.delete('/delete/:id', deleteUser)

export default router;
