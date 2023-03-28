import express from 'express';
import { createGroup, getGroups, deleteGroup } from '../../controllers/group/groupController.js'

const router = express.Router();

router.get('/get-groups/:userId', getGroups);
router.post('/create/:userId', createGroup);
router.delete('/delete/:groupId', deleteGroup);

export default router;