import express from 'express';
import { createMatch, deleteMatch, getAllMatches, updateMatch, updateParticiationStatus } from '../../controllers/match/matchController.js';

const router = express.Router();

router.post('/create/:userId', createMatch);
router.put('/update/:matchId', updateMatch);
router.put('/update-status/:matchId', updateParticiationStatus)
router.get('/group-matches', getAllMatches)
router.delete('/delete/:matchId', deleteMatch);

export default router;