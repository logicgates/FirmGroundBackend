import express from 'express';
import { createChat } from '../../controllers/chat/chatController.js'

const router = express.Router();

router.post('/create', createChat);

export default router;