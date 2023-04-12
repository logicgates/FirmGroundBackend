import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import ChatMsg from '../../models/chatMessages/ChatMessage.js';
import { chatMessageSchema } from '../../schema/chat/chatSchema.js';
import db from '../../config/firebaseConfig.js';

export const getMessages = async (req, res) => {
  const { chatId } = req.params;
  try {
    const chatMsgs = await ChatMsg.find({ chatId }, '-deleted -__v').limit(20);
    if (!chatMsgs)
      return res
        .status(404)
        .send({ error: 'No messages were found for this chat.' });
    res.status(201).send({ chatMessages: chatMsgs });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const addMessage = async (req, res) => {
  const { chatId, message } = req.body;
  const userInfo = req.session.userInfo;
  try {
    await chatMessageSchema.validate(message);
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists)
      return res
        .status(404)
        .send({ error: 'Chat not found.' });
    const user = await User.findById(userInfo?.userId);
    const newMessage = {
      userId: userInfo?.userId,
      userName: user.firstName + ' ' + user.lastName,
      message: message,
      createdAt: new Date(),
    };
    const newMessageRef = await chatRef.collection('messages').add({newMessage});
    const chat = await Chat.findByIdAndUpdate(
      chatId,
      { lastMessage: newMessage, },
      { new: true }
    );
    if (!chat)
      return res
        .status(404)
        .send({ error: 'last message not found.' });
    res.status(201).send({ chat });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  try {
    const message = await ChatMsg.findOne({ _id: messageId }, '-deleted -__v');
    if (!message)
      return res
        .status(404)
        .send({ error: 'Message has already been deleted.' });
    const deleteMessage = await ChatMsg.deleteOne({ _id: messageId });
    if (!deleteMessage)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(201).send({ message: 'Message has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};