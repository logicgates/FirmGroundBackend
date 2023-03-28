import express from 'express';
import { createMatch } from '../../controllers/match/matchController.js';

const router = express.Router();

router.post('/create', createMatch);

export default router;