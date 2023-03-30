import express from 'express';
import {
  createChat,
  getChats,
  deleteChat,
} from '../../controllers/chat/chatController.js';

const router = express.Router();

router.get('/get-chats/:userId', getChats);
router.post('/create/:userId', createChat);
router.delete('/delete/:chatId', deleteChat);

export default router;
