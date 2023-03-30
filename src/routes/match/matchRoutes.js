import express from 'express';
import { createMatch, deleteMatch, getAllMatches, updateMatch } from '../../controllers/match/matchController.js';

const router = express.Router();

router.post('/create/:userId', createMatch);

router.patch('/update/:matchId', updateMatch);

router.get('/group-matches', getAllMatches)

router.delete('/delete/:matchId', deleteMatch);

export default router;