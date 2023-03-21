import express from 'express';
import { register } from '../../controllers/user/userController.js';

const router = express.Router();

router.post('/register', register);

export default router;
