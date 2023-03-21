import express from 'express';
import { register, getAllUsers, login } from '../../controllers/user/userController.js';

const router = express.Router();

router.get('/users', getAllUsers)

router.post('/login', login)

router.post('/register', register);

// router.post('/delete', deleteUser)

export default router;
