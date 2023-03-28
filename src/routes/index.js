import express from 'express';
const router = express.Router();

import chat from './chat/chatRoutes.js';
import user from './user/userRoutes.js';
import match from './match/matchRoutes.js'

router.use('/auth', user);
router.use('/chat', chat);
router.use('/match', match);

export default router;
