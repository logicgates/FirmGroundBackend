import express from 'express';
const router = express.Router();

import chat from './chat/chatRoutes.js';
import group from './group/groupRoutes.js'
import user from './user/userRoutes.js';
import match from './match/matchRoutes.js'

router.use('/auth', user);
router.use('/chat', chat);
router.use('/group', group)
router.use('/match', match);

export default router;
