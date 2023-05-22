import express from 'express';
import { 
    addReminder, 
    deleteReminder, 
    editReminder, 
    viewAllReminders, 
    viewReminder 
} from '../../controllers/reminder/reminderController.js';

const router = express.Router();

router.get('/view/:reminderId', viewReminder);
router.get('/view-all', viewAllReminders);
router.post('/add', addReminder);
router.put('/edit/:reminderId', editReminder);
router.delete('/delete/:reminderId', deleteReminder);

export default router;