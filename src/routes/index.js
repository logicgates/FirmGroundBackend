import express from 'express';
import user from './user/userRoutes.js';
const router = express.Router();

router.use('/auth', user);

router.use('/match', match);

export default router;
