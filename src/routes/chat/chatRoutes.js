import express from 'express';
import {
  createChat,
  updateChat,
  getChats,
  deleteChat,
  getChatMessages,
  createChatMessage,
  deleteChatMessage,
  addMembers,
  removeMemeber,
  makeAdmin,
  removeAdmin,
  leaveChat
} from '../../controllers/chat/chatController.js';
import { upload } from '../../config/multerConfig.js';

const router = express.Router();

router.get('/get-chats', getChats);
router.post('/create', createChat);
router.put('/update/:chatId', upload.single('image'), updateChat);
router.delete('/delete/:chatId', deleteChat);

router.put('/add-members/:chatId', addMembers);
router.put('/remove-members/:chatId', removeMemeber);
router.put('/make-admin/:chatId', makeAdmin);
router.put('/remove-admin/:chatId', removeAdmin);
router.put('/leave-chat/:chatId', leaveChat);

router.get('/get-messages/:chatId', getChatMessages);
router.post('/create-message/:chatId', createChatMessage);
router.delete('/delete-message/:messageId', deleteChatMessage);

export default router;
