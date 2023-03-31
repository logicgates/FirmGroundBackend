import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';

export const createChat = async (req, res) => {
  const { members } = req.body;
  const membersArray = members.split(',');
  try {
    let privateUser = '';
    let chatAlreadyExists = false;
    let checkIfPrivate = membersArray.length > 1 ? false : true; // Checking if chat is private or group
    if (checkIfPrivate) {
      privateUser = await User.findById(membersArray[0]);
      chatAlreadyExists = await Chat.find({
        // Checking if private chat already exists
        $and: [{ membersList: privateUser.id }, { isPrivate: true }],
      });
    }
    if (chatAlreadyExists)
      return res.status(400).send({ error: 'Private chat already exists.' });
    let today = new Date();
    let newChat = await Chat.create({
      title:
        checkIfPrivate === true ? 
          privateUser.firstName + ' ' + privateUser.lastName : 
          req.body.title,
      admins: req.params.userId,
      membersList: [],
      creationDate: today,
      isPrivate: checkIfPrivate,
    });
    membersArray.forEach((member) => {
      newChat.membersList.push(member);
    });
    newChat.save();
    res.status(201).send({ chat: newChat, message: 'Chat created.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getChats = async (req, res) => {
  const { userId } = req.params;
  try {
    const userChats = await Chat.find({
      // Find all chats the user is in only
      $or: [{ admins: userId }, { membersList: userId }],
    });
    if (!userChats) return res.status(404).send({ error: 'No chats found.' });
    res.status(200).send({ userChats });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  try {
    const user = await Chat.findById(chatId);
    if (!user) return res.status(404).send({ error: 'Chat does not exist.' });
    await Chat.deleteOne({ _id: chatId });
    res.status(201).send({ message: 'Chat has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
