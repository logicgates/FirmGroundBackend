import express from 'express';
import {
  createChat,
  updateChat,
  getAllChats,
  deleteChat,
  addMembers,
  removeMember,
  makeAdmin,
  removeAdmin,
  leaveChat,
  getChat
} from '../../controllers/chat/chatController.js';
import {
  getMessages,
  createMessage,
  deleteMessage,
} from '../../controllers/chatMessage/chatMessageController.js'
import { upload } from '../../config/multerConfig.js';

const router = express.Router();

router.get('/get-chat/:chatId', getChat);
router.get('/get-chats', getAllChats);
router.post('/create', upload.single('image'), createChat);
router.put('/update/:chatId', upload.single('image'), updateChat);
router.delete('/delete/:chatId', deleteChat);

router.put('/add-members/:chatId', addMembers);
router.put('/remove-members/:chatId', removeMember);
router.put('/make-admin/:chatId', makeAdmin);
router.put('/remove-admin/:chatId', removeAdmin);
router.put('/leave-chat/:chatId', leaveChat);

router.get('/get-messages/:chatId', getMessages);
router.post('/create-message/:chatId', createMessage);
router.delete('/delete-message/:userId', deleteMessage);

export default router;
