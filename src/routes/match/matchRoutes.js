import express from 'express';
import { create } from '../../controllers/match/matchController';

const router = express.Router();

router.post('/create', create);

export default router;