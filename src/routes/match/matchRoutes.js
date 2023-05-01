import express from 'express';
import { 
    addPlayerToTeam,
    createMatch,
    cancelMatch,
    deleteMatch, 
    getActivePlayers, 
    getAllMatches, 
    updateMatch, 
    updateParticiationStatus, 
    updatePaymentStatus,
    removePlayerFromTeam
} from '../../controllers/match/matchController.js';

const router = express.Router();

router.get('/group-matches/:chatId', getAllMatches);
router.get('/active-list/:matchId', getActivePlayers);
router.post('/create', createMatch);
router.put('/update/:matchId', updateMatch);
router.put('/update-status/:matchId', updateParticiationStatus);
router.put('/update-payment/:matchId', updatePaymentStatus)
router.put('/add-to-team/:matchId', addPlayerToTeam);
router.put('/remove-from-team/:matchId', removePlayerFromTeam);
router.put('/cancel/:matchId', cancelMatch);
router.delete('/delete/:matchId', deleteMatch);

export default router;