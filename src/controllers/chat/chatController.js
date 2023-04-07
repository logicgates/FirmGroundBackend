import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import ChatMsg from '../../models/chatMessages/ChatMessage.js';
import { chatMessageSchema } from '../../schema/chat/chatSchema.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/awsConfig.js';
import crypto from 'crypto';
import sharp from 'sharp';

const bucketName = process.env.S3_BUCKET_NAME;

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
            { membersList: members[0] },
          ],
        },
        '-deleted -__v'
      );
    }
    if (chatExists)
      return res.status(400).send({ error: 'Private chat already exists.' });
    let today = new Date();
    let newChat = await Chat.create({
      title: checkIfPrivate === true ? 'Private chat' : req.body.title,
      admins: checkIfPrivate === true ? [] : userInfo?.userId,
      membersList: [],
      creationDate: today,
      isPrivate: checkIfPrivate,
      chatImage: '',
    });
    if (checkIfPrivate) newChat.membersList.push(userInfo?.userId);
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
        $or: [{ admins: userInfo?.userId }, { membersList: userInfo?.userId }],
      },
      '-deleted -__v'
    );
    if (!chats) return res.status(404).send({ error: 'No chats found.' });
    for (const chat of chats) {
      if (chat.isPrivate) {
        let memberId = chat.membersList.filter(
          (user) => userInfo?.userId !== user
        );
        let member = await User.findOne(
          { _id: memberId[0] },
          'firstName lastName'
        );
        chat.title = member.firstName + ' ' + member.lastName;
        chat.chatImage = member.profileImage;
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
    if (!chat) return res.status(404).send({ error: 'Chat was not found.' });
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
      res.status(200).send({ chat: updatedChat, message: 'Left chat successfully.' });
    }
    const isMember = Chat.membersList.includes(userInfo?.userId);
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
  const userInfo = req.session.userInfo;
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat does not exist' });
    if (chat.isPrivate) {
      const isMember = chat.membersList.includes(userInfo?.userId);
      if (!isMember)
        return res
          .status(401)
          .send({ error: 'You are not a part of this chat.' });
    } else {
      if (chat.admins[0] !== userInfo?.userId)
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

export const getChatMessages = async (req, res) => {
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

export const createChatMessage = async (req, res) => {
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
      return res.status(404).send({ error: 'Error retrieving user details.' });
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) return res.status(404).send({ error: 'Chat does not exist' });
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
};

export const deleteChatMessage = async (req, res) => {
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
