import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import ChatMsg from '../../models/chatMessages/ChatMessages.js';
import { object, string } from 'yup';

const chatMessageSchema = object({
  message: string(),
});

export const createChat = async (req, res) => {
  const { members } = req.body;
  const userInfo = req.session.userInfo;
  try {
    let chatExists = false;
    let checkIfPrivate = members.length > 1 ? false : true; // Checking if chat is private or group
    if (checkIfPrivate) {
      // Checking if private chat already exists
      chatExists = await Chat.findOne(
        {
          $and: [
            { membersList: userInfo?.userId }, 
            { membersList: members[0] }
          ]
        }, '-deleted -__v'
      );
    }
    if (chatExists)
      return res
        .status(400)
        .send({ error: 'Private chat already exists.' });
    let today = new Date();
    let newChat = await Chat.create({
      title: req.body.title,
      admins: checkIfPrivate === true ? [] : userInfo?.userId,
      membersList: [],
      creationDate: today,
      isPrivate: checkIfPrivate,
    });
    if (checkIfPrivate) 
      newChat.membersList.push(userInfo?.userId);
    members.forEach((member) => {
      newChat.membersList.push(member);
    });
    newChat.save();
    res.status(201).send({ chat: newChat, message: 'Chat created.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getChats = async (req, res) => {
  const userInfo = req.session.userInfo;
  try {
    const chats = await Chat.find(
      // Find all chats the user is in as admin or member
      {
        $or: [
          { admins: userInfo?.userId }, 
          { membersList: userInfo?.userId }
        ],
      }, '-deleted -__v'
    );
    if (!chats)
      return res
        .status(404)
        .send({ error: 'No chats found.' });
    res.status(200).send({ chats });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat does not exist' });
    if (chat.isPrivate) {
      const isMember = chat.membersList.includes(userInfo?.userId);
      if (!isMember)
        return res
          .status(401)
          .send({ error: 'You are not a part of this chat.' });
    }
    else {
      if (chat.admins[0] !== userInfo?.userId)
        return res
          .status(401)
          .send({ error: 'Only admins can delete a chat.' });
    }
    await Chat.deleteOne({ _id: chatId });
    res.status(201).send({ message: 'Chat has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getChatMessages = async (req,res) => {
  const { chatId } = req.params;
  try {
    const chatMsgs = await ChatMsg.find({ chatId }, '-deleted -__v');
    if (!chatMsgs)
      return res
        .status(404)
        .send({ error: 'No messages were found for this chat.' });
    res.status(201).send({ chatMessages: chatMsgs });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const createChatMessage = async (req,res) => {
  const { chatId } = req.params;
  const userInfo = req.session.userInfo;
  try {
    await chatMessageSchema.validate(req.body);
    const user = await User.findOne(
      {
        _id: userInfo?.userId,
        email: userInfo?.email,
      },
      '-deleted -__v -password'
    );
    if (!user)
      return res
        .status(404)
        .send({ error: 'Error retrieving user details.'});
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat does not exist' });
    const message = await ChatMsg.create({
      chatId: chatId,
      userId: userInfo?.userId,
      userName: user.firstName + ' ' + user.lastName,
      message: req.body?.message,
    });
    if (!message)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  res.status(200).send({ chatMessage: message });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const deleteChatMessage = async (req,res) => {
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
}