import express from 'express';
import { 
    addReminder, 
    deleteReminder, 
    editReminder, 
    getAllReminder, 
    getReminder 
} from '../../controllers/reminder/reminderController.js';

const router = express.Router();

router.get('/get/:reminderId', getReminder);
router.get('/get-all/:matchId', getAllReminder);
router.post('/add/:matchId', addReminder);
router.put('/edit/:reminderId', editReminder);
router.delete('/delete/:reminderId', deleteReminder);

export default router;