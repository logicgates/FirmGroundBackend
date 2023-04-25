import express from 'express';
import { 
    getStadiumLocations,
    addStadium,  
    updateStadium,
    deleteStadium
} from '../../controllers/stadium/stadiumController.js';
import { upload } from '../../config/multerConfig.js';

const router = express.Router();

router.get('/get-all', getStadiumLocations);
router.post('/add', upload.single('image'), addStadium);
router.put('/update/:stadiumId', upload.single('image'), updateStadium);
router.delete('/delete/:stadiumId', deleteStadium);

export default router;