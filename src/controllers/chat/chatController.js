import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/awsConfig.js';
import db from '../../config/firebaseConfig.js';
import crypto from 'crypto';
import sharp from 'sharp';

const bucketName = process.env.S3_BUCKET_NAME;

async function deleteFromBucket (objKey) {
  const commandDel = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: `${
        objKey.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
      }`,
    });
    await s3Client.send(commandDel);
}

async function addToBucket (image, collection) {
  const fileName = crypto.randomBytes(32).toString('hex');
  const fileMimetype = image.mimetype.split('/')[1];
  const buffer = await sharp(image.buffer)
    .resize({ width: 520, height: 520, fit: 'contain' })
    .toBuffer();
  const commandPut = new PutObjectCommand({
    Bucket: bucketName,
    Key: `${collection}/${fileName}.${fileMimetype}`,
    Body: buffer,
    ContentType: image.mimetype,
  });
  await s3Client.send(commandPut);
  return `${process.env.S3_BUCKET_ACCESS_URL}${collection}/${fileName}.${fileMimetype}`;
}

export const createChat = async (req, res) => {
  const { title, members } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const isPrivate = members.length === 1;
    const chatExists = isPrivate && await Chat.findOne({
      membersList: {
        $elemMatch: { _id: userId },
        $elemMatch: { _id: members[0]._id }
      },
      isPrivate: true,
      isDeleted: false
    }, '-deleted -__v');
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
    newChat.title = isPrivate ? `${members[0].firstName} ${members[0].lastName}` : newChat.title;
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
        ],
        $and: [ { isDeleted: false } ]
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
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to update chat group.' });
    const fileName = req.file ? await addToBucket(req.file, 'chat') : chat?.chatImage;
    if (chat?.chatImage !== fileName)
      await deleteFromBucket(chat.chatImage);
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      {
        title: req.body?.title,
        chatImage: fileName,
      },
      { new: true }
    );
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
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Private chat is limited to two members.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to add new members.' });
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId, 
      { $push: { membersList: { $each: members } } },
      { new: true }
    );
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'New member(s) added successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const removeMemeber = async (req,res) => {
  const { chatId } = req.params;
  const { memberId } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Unable to perform action in private chat.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to remove a member.' });
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId, 
      { $pull: { membersList: { _id: memberId } } },
      { new: true }
    );
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'Member removed successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const makeAdmin = async (req,res) => {
  const { chatId } = req.params;
  const { memberId } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Unable to perform action in private chat.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    const member = chat.membersList.find((member) => member._id === memberId);
    if (!member)
     return res
      .status(404)
      .send({ error: 'This person is not part of the chat group.' });
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId, 
      {
        $pull: { membersList: { _id: memberId } },
        $push: { admins: member },
      },
      { new: true }
    );
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'Assigned as admin successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const removeAdmin = async (req,res) => {
  const { chatId } = req.params;
  const { memberId } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Unable to perform action in private chat.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    const member = chat.admins.find((admin) => admin._id === memberId);
    if (!member)
     return res
      .status(404)
      .send({ error: 'This person is not part of the chat group.' });
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId, 
      {
        $push: { membersList: member },
        $pull: { admins: { _id: memberId } },
      },
      { new: true }
    );
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ chat: updatedChat, message: 'Assigned as admin successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const leaveChat = async (req,res) => {
  const { chatId } = req.params;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Unable to perform action in private chat.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (isAdmin) {
      const randomIndex = Math.floor(Math.random() * (chat.membersList.length - 1));
      if (chat.admins.length === 1) {
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
          $push: { admins: membersList[randomIndex] },
          $pull: { admins: { _id: userId } },
          $pop: { membersList: -1 },
        });
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ chat: updatedChat, message: 'Left chat successfully.' });
      }
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $pull: { admins: { _id: userId } },
      });
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ message: 'You have left chat group successfully.' });
    }
    const isMember = chat.membersList.find((member) => member._id === userId);
    if (isMember) {
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $pull: { membersList: { _id: userId } },
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
};

export const deleteChat = async (req, res) => {
  const { chatId } = req.params;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Unable to delete private chat.' });
    if (chat.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is already deleted.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    await deleteFromBucket(chat.chatImage);
    const deleteChat = await Chat.findByIdAndUpdate(
    chatId,
    { isDeleted: true },
    { new: true }
    );
    if (!deleteChat)
    return res
      .status(404)
      .send({ error: 'Something went wrong please try again later.' });
    res.status(201).send({ message: 'Chat has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
