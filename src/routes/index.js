import express from 'express';
const router = express.Router();

import chat from './chat/chatRoutes.js';
import user from './user/userRoutes.js';
import match from './match/matchRoutes.js'
import stadium from './stadium/stadiumRoutes.js';
import reminder from './reminder/reminderRoutes.js';
import User from '../models/user/User.js';

async function checkUserSession (req, res, next) {
    const userId = req.session.userInfo?.userId;
    const user = await User.findOne({ _id: userId });
    if (!user)
        return res
            .status(401)
            .send({ error: 'User timeout. Please login again.' });
    if (user.deleted?.isDeleted)
        return res
            .status(404)
            .send({ error: 'Not allowed' });
    
    const userInfo = {
        userId: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage,
        deviceId: user.deviceId
    }
    req.userInfo = userInfo;
    next();
};

router.use('/auth', user);
router.use('/chat', checkUserSession, chat);
router.use('/match', checkUserSession, match);
router.use('/stadium', checkUserSession, stadium);
router.use('/reminder', checkUserSession, reminder);

export default router;
