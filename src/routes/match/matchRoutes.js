import express from 'express';
import { createMatch, getMatches } from '../../controllers/match/matchController.js';

const router = express.Router();

router.post('/create', createMatch);

router.get('/get-match', getMatches)

export default router;