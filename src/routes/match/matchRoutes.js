import express from 'express';
import { createMatch } from '../../controllers/match/matchController';

const router = express.Router();

router.post('/create', createMatch);

export default router;