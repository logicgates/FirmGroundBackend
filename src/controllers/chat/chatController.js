import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/Chat.js';

export const createChat = async (req,res) => {
    const { userId } = req.params;
  try {
    let today = new Date();
    let newChat = await Chat.create({
      userA: userId,
      userB: req.body.userB,
      creationDate: today,
    });
    res.status(201).send({chat: newChat, message:'Chat created.'});
  } catch (error) {
        errorMessage(res,error);
  }
}

export const getChats = async (req,res) => {
  const { userId } = req.params;
  try {
    const userChats = await Chat.find({ // Find all chats the user is in only
      $or: [ 
        { userA: userId }, 
        { userB: userId }
      ],
    });
    if (!userChats) return res.status(404).send({ error: 'No chats found.' });
    res.status(200).send({ userChats });
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteChat = async (req,res) => {
  const { chatId } = req.params;
  try {
    const user = await Chat.findById(chatId);
    if(!user) return res.status(404).send({error: 'Chat does not exist.'});
    await Chat.deleteOne({_id: chatId});
    res.status(201).send({message: 'Chat has been deleted.'});
  } catch (error) {
    errorMessage(res,error);
  }
}