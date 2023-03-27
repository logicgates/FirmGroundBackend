import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/Chat.js';
// import { object, string } from 'yup';

export const createChat = async (req,res) => {
    const { members } = req.body;
  try {
    let newChat = await Chat.create({
        userId: req.params.userId,
        members: [],
      });
      members.forEach((member) => { newChat.members.push(member); });
      newChat.save();
      res.status(201).send({chat: newChat, message:'Chat Group created.'});
  } catch (error) {
        errorMessage(res,error);
  }
}
