import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import ChatMsg from '../../models/chatMessages/ChatMessage.js';
// import { chatMessageSchema } from '../../schema/chat/chatSchema.js';
import db from '../../config/firebaseConfig.js';

export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  try {
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists)
      return res
        .status(404)
        .send({ error: 'Chat not found.' });
    const messagesSnapshot = await chatRef
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const messages = [];
    messagesSnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).send({ messages });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const createMessage = async (req, res) => {
  const { message } = req.body;
  const { chatId } = req.params;
  const userInfo = req.session.userInfo;
  try {
    // await chatMessageSchema.validate(req.body);
    const chatExists = await Chat.find({ chatId }, '-deleted -__v')
    if (!chatExists)
      return res
        .status(404)
        .send({ error: 'Chat not found.' });
    const user = await User.findById(userInfo?.userId);
    const newMessage = {
      userId: userInfo?.userId,
      userName: user.firstName + ' ' + user.lastName,
      message: message,
      createdAt: new Date().toISOString(),
    };
    const chatRef = db.collection('chats').doc(chatId);
    const messagesRef = await chatRef.collection('messages').add(newMessage);
    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { lastMessage: newMessage, },
      { new: true }
    );
    if (!chat)
      return res
        .status(404)
        .send({ error: 'last message not found.' });
    const messagesSnapshot = await chatRef
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const messages = [];
    messagesSnapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    res.status(201).send({ messages });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteMessage = async (req, res) => {
  const { chatId, messageId } = req.body;
  try {
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc)
      return res
        .status(404)
        .send({ error: 'Chat not found.' });
    const messageRef = chatRef.collection('messages').doc(messageId);
    const messageDoc = await messageRef.get();
    if (!messageDoc)
      return res
        .status(404)
        .send({ error: 'Message not found' });
    const deleteMsg = await messageRef.delete();
    if (!deleteMsg)
      return res
        .status(404)
        .send({ error: 'Something went wrong. Please try again later.'});
    res.status(302).redirect('/api/v1/chat/get-messages/' + chatId);
  } catch (error) {
    errorMessage(res, error);
  }
};