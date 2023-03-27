import express from 'express';
import chat from '../models/chat/chat.js';
import user from './user/userRoutes.js';
const router = express.Router();

router.use('/auth', user);
router.use('/match', match);
router.use('/chat', chat)

export default router;
