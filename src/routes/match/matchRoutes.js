import express from 'express';
import { 
    addPlayersToTeam,
    createMatch,
    cancelMatch,
    deleteMatch, 
    getActivePlayers, 
    getAllMatches, 
    updateMatch, 
    updateParticiationStatus, 
    updatePaymentStatus,
    removePlayerFromTeam,
    updatePlayerAddition
} from '../../controllers/match/matchController.js';

const router = express.Router();

router.get('/group-matches/:chatId', getAllMatches);
router.get('/active-list/:matchId', getActivePlayers);
router.post('/create', createMatch);
router.put('/update/:matchId', updateMatch);
router.put('/addition/:matchId', updatePlayerAddition);
router.put('/update-status/:matchId', updateParticiationStatus);
router.put('/update-payment/:matchId', updatePaymentStatus)
router.put('/add-to-team/:matchId', addPlayersToTeam);
router.put('/remove-from-team/:matchId', removePlayerFromTeam);
router.put('/cancel/:matchId', cancelMatch);
router.delete('/delete/:matchId', deleteMatch);

export default router;