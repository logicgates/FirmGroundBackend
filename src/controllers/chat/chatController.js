import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/awsConfig.js';
import db from '../../config/firebaseConfig.js';
import crypto from 'crypto';
import sharp from 'sharp';

const bucketName = process.env.S3_BUCKET_NAME;

export const createChat = async (req, res) => {
  const { title, members } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const isPrivate = members.length === 1;
    const chatExists = isPrivate && await Chat.findOne({ membersList: { $all: [{_id: userId}, {_id: members[0]._id}] } }, '-deleted -__v');
    if (chatExists)
      return res
        .status(400)
        .send({ error: 'Private chat already exists.' });
    const user = await User.findOne({ _id: userId }, '-deleted -__v');
    const userObj = { 
      _id: userId, 
      firstName: user.firstName,
      lastName: user.lastName, 
      phone: user.phone,
      profileUrl: user.profileUrl,
    };
    const newChat = await Chat.create({
      title: isPrivate ? 'Private chat' : title,
      admins: isPrivate ? [] : userObj,
      membersList: isPrivate ? [userObj, members[0]] : [...members],
      creationDate: new Date(),
      isPrivate,
      isDeleted: false,
      chatImage: '',
      lastMessage: {}
    });
    // Add the new chat to Firestore
    const chatId = newChat._id.toString(); 
    const newChatRef = await db.collection('chats').doc(chatId).set({
      title: newChat.title,
      creationDate: newChat.creationDate,
      isPrivate: newChat.isPrivate,
    });
    if (!newChat || !newChatRef)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(201).send({ chat: newChat, message: 'Chat created.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getChats = async (req, res) => {
  const userId = req.session.userInfo?.userId;
  try {
    const chats = await Chat.find(
      {
        $or: [
          { admins: { $elemMatch: { _id: userId } } },
          { membersList: { $elemMatch: { _id: userId } } }
        ]
      },
      '-deleted -__v'
    );
    if (!chats) 
      return res
        .status(404)
        .send({ error: 'No chats were found.' });
    for (const chat of chats) {
      if (chat.isPrivate) {
        const member = chat.membersList.find((member) => member._id !== userId);
        chat.title = `${member.firstName} ${member.lastName}`;
      }
    }
    res.status(200).send({ chats });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updateChat = async (req, res) => {
  const { chatId } = req.params;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    const isAdmin = chat.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to update chat group.' });
    let fileName = '';
    if (req.file) {
      if (chat?._doc?.chatImage) {
        const commandDel = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: `${
            chat?.chatImage?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
          }`,
        });
        await s3Client.send(commandDel);
      }
      fileName = crypto.randomBytes(32).toString('hex');
      const fileMimetype = req.file.mimetype.split('/')[1];
      const buffer = await sharp(req.file.buffer)
        .resize({ width: 520, height: 520, fit: 'contain' })
        .toBuffer();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `chat/${fileName}.${fileMimetype}`,
        Body: buffer,
        ContentType: req.file.mimetype,
      });
      s3Client.send(command);
    }
    const updatedChat = await Chat.findByIdAndUpdate(chatId, {
      title: req.body?.title,
      chatImage: `${process.env.S3_BUCKET_ACCESS_URL}chat/${fileName}.${fileMimetype}`,
    });
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const addMembers = async (req, res) => {
  const { chatId } = req.params;
  const { members } = req.body;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat was not found.' });
    if (chat.isPrivate) return res.status(404).send({ error: 'Unable to perform action in private chat.' });
    const isAdmin = chat.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to add new members.' });
    const updatedChat = await Chat.findByIdAndUpdate(chatId, {
      $push: { membersList: { $each: members } },
    });
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'New member(s) added successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const removeMemeber = async (req,res) => {
  const { chatId } = req.params;
  const { member } = req.body;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat was not found.' });
    if (chat.isPrivate) return res.status(404).send({ error: 'Unable to perform action in private chat.' });
    const isAdmin = chat.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to add new members.' });
    const updatedChat = await Chat.findByIdAndUpdate(chatId, {
      $pull: { membersList: member },
    });
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'Member removed successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const makeAdmin = async (req,res) => {
  const { chatId } = req.params;
  const { member } = req.body;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat was not found.' });
    if (chat.isPrivate) return res.status(404).send({ error: 'Unable to perform action in private chat.' });
    const isAdmin = chat.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    const updatedChat = await Chat.findByIdAndUpdate(chatId, {
      $pull: { membersList: member },
      $push: { admins: member },
    });
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'Assigned as admin successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const removeAdmin = async (req,res) => {
  const { chatId } = req.params;
  const { member } = req.body;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat was not found.' });
    if (chat.isPrivate) return res.status(404).send({ error: 'Unable to perform action in private chat.' });
    const isAdmin = chat.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    const updatedChat = await Chat.findByIdAndUpdate(chatId, {
      $pull: { admins: member },
      $push: { membersList: member },
    });
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'Assigned as admin successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const leaveChat = async (req,res) => {
  const { chatId } = req.params;
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat was not found.' });
    if (chat.isPrivate) return res.status(404).send({ error: 'Unable to perform action in private chat.' });
    const isAdmin = chat.admins.includes(userInfo?.userId);
    if (isAdmin) {
      const adminCount = chat.admins.length;
      if (adminCount === 1) {
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
          $push: { admins: membersList[0] },
          $pull: { admins: userInfo?.userId },
          $pop: { membersList: -1 },
        });
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ chat: updatedChat, message: 'Left chat successfully.' });
      }
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $pull: { admins: userInfo?.userId },
      });
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ message: 'You have left chat group successfully.' });
    }
    const isMember = chat.membersList.includes(userInfo?.userId);
    if (isMember) {
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $pull: { membersList: userInfo?.userId },
      });
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ chat: updatedChat, message: 'Left chat successfully.' });
    }
  } catch (error) {
    errorMessage(res, error);
  }
}

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.session.userInfo?.userId;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat does not exist' });
    if (chat.isPrivate) {
      const isMember = chat.membersList.find((member) => member._id !== userId);
      if (!isMember)
        return res
          .status(401)
          .send({ error: 'You are not a part of this chat.' });
    } else if (chat.admins.find((admin) => admin._id !== userId)) {
        return res
          .status(401)
          .send({ error: 'Only admins can delete a chat.' });
    }
    const commandDel = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: `${
        chat?.chatImage?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
      }`,
    });
    await s3Client.send(commandDel);
    await Chat.deleteOne({ _id: chatId });
    res.status(201).send({ message: 'Chat has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
