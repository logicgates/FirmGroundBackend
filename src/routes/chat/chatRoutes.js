import express from 'express';
import {
  createChat,
  updateChat,
  getChats,
  deleteChat,
  getChatMessages,
  createChatMessage,
  deleteChatMessage,
} from '../../controllers/chat/chatController.js';
import { upload } from '../../config/multerConfig.js';

const router = express.Router();

router.get('/get-chats', getChats);
router.post('/create', createChat);
router.put('/update/:chatId', upload.single('image'), updateChat)
router.delete('/delete/:chatId', deleteChat);

router.get('/get-messages/:chatId', getChatMessages);
router.post('/create-message/:chatId', createChatMessage);
router.delete('/delete-message/:messageId', deleteChatMessage);

export default router;
