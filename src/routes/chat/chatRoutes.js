import express from 'express';
import {
  createChat,
  getChats,
  deleteChat,
  getChatMessages,
  createChatMessage,
} from '../../controllers/chat/chatController.js';

const router = express.Router();

router.get('/get-chats/:userId', getChats);
router.post('/create/:userId', createChat);
router.delete('/delete/:chatId', deleteChat);

router.get('/get-messages/:chatId', getChatMessages);
router.post('/create-message/:chatId', createChatMessage);

export default router;
