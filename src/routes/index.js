import express from 'express';
const router = express.Router();

import chat from './chat/chatRoutes.js';
import user from './user/userRoutes.js';
import match from './match/matchRoutes.js'
import stadium from './stadium/stadiumRoutes.js';
import reminder from './reminder/reminderRoutes.js';

router.use('/auth', user);
router.use('/chat', chat);
router.use('/match', match);
router.use('/stadium', stadium);
router.use('/reminder', reminder);

export default router;
