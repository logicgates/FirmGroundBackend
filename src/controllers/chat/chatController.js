import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import Match from '../../models/match/Match.js';
import { deleteFromBucket, addToBucket } from '../../config/awsConfig.js';
import db from '../../config/firebaseConfig.js';
import Firestore from '@google-cloud/firestore';

const calculateStatusCounts = async (userId, chatId) => {

  const matches = await Match.find({ chatId, 'deleted.isDeleted': false, isCancelled: false }, 'players');

  const statusCount = {
    IN: 0,
    OUT: 0,
    PENDING: 0,
    TOTAL: 0
  };

  statusCount.TOTAL = matches.length;
  for (const match of matches) {
    for (const { _id, participationStatus } of match.players) {
      if (_id && _id.toString() === userId) {
        if (participationStatus === 'in') {
          statusCount.IN++;
          break;
        } else if (participationStatus === 'out') {
          statusCount.OUT++;
          break;
        } else if (participationStatus === 'pending') {
          statusCount.PENDING++;
          break;
        }
      }
    }
  }

  return statusCount;
};

async function checkPlayerInMatches (res, memberId, chatId) {

  const matches = await Match.find(
    {
      chatId,
      'deleted.isDeleted': false,
      isCancelled: false,
      isLocked: false,
    },
    'players'
  ).populate('players.info', 'firstName');

  for (const match of matches) {
    const player = match.players.find((player) => (player._id.toString() === memberId));
    if (player) {
      if (player.payment === 'paid') {
        res.status(404).send({ error: `${player.info.firstName} has a completed payment for upcoming match.` });
        return false;
      }
      if (player.addition > 0) {
        res.status(404).send({ error: `${player.info.firstName} has additional players for upcoming match.` });
        return false;
      }
    }
  }

  return true;
};

async function addPlayersToMatches (memberIds, chatId) {

  const playerData = memberIds.map((memberId) => ({
    _id: memberId,
    info: memberId,
    participationStatus: 'pending',
    isActive: false,
    payment: 'unpaid',
    team: '',
    addition: 0
  }))

  const matches = await Match.find(
    {
      chatId,
      'deleted.isDeleted': false,
      isCancelled: false,
      isLocked: false,
    },
    'players'
  );

  for (const match of matches) {
      match.players.push(...playerData); 
      await match.save(); // Await the save operation
  }

};

async function removePlayerFromMatches (memberId, chatId) {

  const matches = await Match.find(
    {
      chatId,
      'deleted.isDeleted': false,
      isCancelled: false,
      isLocked: false,
    },
    'players'
  ).populate('players.info', 'firstName');

  for (const match of matches) {
    const player = match.players.find((player) => (player._id.toString() === memberId));
    if (player) {
      match.players.pull(memberId); 
      await match.save(); // Await the save operation
    }
  }

};

export const createChat = async (req, res) => {
  const { title, members } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const parsedMembers = typeof members === 'string' ? JSON.parse(members) : members;
    const isPrivate = parsedMembers.length === 1;
    const chatExists = isPrivate && await Chat.findOne({
      $and: [
        { membersList: { _id: userId } },
        { membersList: { _id: parsedMembers[0]._id } },
        { isPrivate: true },
      ]
    }, '-__v');
    if (chatExists) {
      const member = chatExists.membersList.find((member) => member._id.toString() !== userId);
      const user = await User.findOne({ _id: member._id }).select('firstName lastName');
      chatExists.title = `${user.firstName} ${user.lastName}`;
      chatExists.chatImage = user.profileImage ? user.profileImage : chatExists.chatImage;
      return res.status(200).send({ chat: chatExists, isAlreadyExist: true });
    }
    const fileName = req.file 
      ? await addToBucket(req.file, 'chat') 
      : isPrivate 
        ? 'https://cdn.pixabay.com/photo/2017/11/10/05/48/user-2935527_1280.png' 
        : 'https://cdn.pixabay.com/photo/2017/11/10/05/46/group-2935521_1280.png';
    const memberIds = isPrivate ? [userId, parsedMembers[0]._id] : parsedMembers.map(member => member._id);
    const newChat = await Chat.create({
      title: isPrivate ? 'Private chat' : title,
      admins: isPrivate ? [] : userId,
      membersList: memberIds,
      creationDate: new Date(),
      chatImage: fileName,
      isPrivate,
      deleted: {},
      matchExist: false,
    });

    newChat.title = isPrivate ? `${parsedMembers[0].firstName} ${parsedMembers[0].lastName}` : newChat.title;
    await newChat.populate('admins', 'firstName lastName phone profileUrl deviceId');
    await newChat.populate('membersList', 'firstName lastName phone profileUrl deviceId');

    // Add the new chat to Firestore
    const chatId = newChat._id.toString(); 
    const newChatRef = await db.collection('chats').doc(chatId).set({
      title: newChat.title,
      creationDate: newChat.creationDate,
      isPrivate: newChat.isPrivate,
      chatImage: fileName,
      deleted: false,
    });

    if (!newChat || !newChatRef)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const statusCount = { IN: 0, OUT: 0, PENDING: 0, TOTAL: 0 };
    res.status(201).send({ chat: newChat, isAlreadyExist: false, message: 'Chat created.', statusCount});
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getChat = async (req, res) => {
  const userId = req.session.userInfo?.userId;
  const { chatId } = req.params;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v')
      .populate('admins', 'firstName lastName phone profileUrl deviceId')
      .populate('membersList', 'firstName lastName phone profileUrl deviceId');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate) {
      const member = chat.membersList.find((member) => member._id.toString() !== userId);
      chat.title = `${member.firstName} ${member.lastName}`;
      res.status(200).send({ chat });
    } else {
      const statusCount = await calculateStatusCounts(userId, chat._id);
      const chatsWithStatusCount = {
        ...chat.toObject(),
        statusCount,
      };
      res.status(200).send({ chat: chatsWithStatusCount });
    }
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getAllChats = async (req, res) => {
  const userId = req.session.userInfo?.userId;
  if (!userId)
    return res
      .status(401)
      .send({ error: 'User timeout. Please login again.' });
  try {
    const chats = await Chat.find({
        $or: [
          { admins: {  _id: userId } },
          { membersList: { _id: userId } }
        ],
        'deleted.isDeleted': false
      }, '-__v');
    if (!chats) 
      return res
        .status(404)
        .send({ error: 'No chats were found.' });
    const chatsWithStatusCount = [];
    for (const chat of chats) {
      if (chat.isPrivate) {
        const member = chat.membersList.find((member) => member._id.toString() !== userId);
        const user = await User.findOne({ _id: member._id }).select('firstName lastName');
        chat.title = `${user.firstName} ${user.lastName}`;
        chatsWithStatusCount.push(chat);
      } else {
        const statusCount = await calculateStatusCounts(userId, chat._id);
        chatsWithStatusCount.push({
          ...chat.toObject(),
          statusCount,
        });
      }
    }
    res.status(200).send({ chats: chatsWithStatusCount });
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
    const chat = await Chat.findOne(
      { 
        _id: chatId, 
        'deleted.isDeleted': false,
        isPrivate: false
      }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin.toString() === userId);
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
      { new: true })
        .populate('admins', 'firstName lastName phone profileUrl deviceId')
        .populate('membersList', 'firstName lastName phone profileUrl deviceId');
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.update({
      title: updatedChat.title,
      chatImage: fileName,
    });
    const statusCount = await calculateStatusCounts(userId, chat._id);
    const chatsWithStatusCount = {
      ...updatedChat.toObject(),
      statusCount,
    };
    res.status(200).send({ chat: chatsWithStatusCount });
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
    const chat = await Chat.findOne({
      _id: chatId,
      'deleted.isDeleted': false,
      isPrivate: false,
    }).select('-__v');
    if (!chat) {
      return res.status(404).send({ error: 'Chat is unavailable.' });
    }

    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    if (!isAdmin) {
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to add new members.' });
    }

    const addMembers = members.filter((member) => {
      const isAdmin = chat.admins.some(
        (admin) => admin._id.toString() === member._id.toString()
      );
      const isMember = chat.membersList.some(
        (mbr) => mbr._id.toString() === member._id.toString()
      );
      return !isAdmin && !isMember;
    });
    if (addMembers.length === 0) {
      return res.status(400).send({ error: 'No valid members to add.' });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { membersList: { $each: addMembers } } },
      { new: true }
    )
      .populate('admins', 'firstName lastName phone profileUrl deviceId')
      .populate('membersList', 'firstName lastName phone profileUrl deviceId');
    if (!updatedChat) {
      return res
        .status(500)
        .send({ error: 'Something went wrong, please try again later.' });
    }

    const userLoggedIn = updatedChat.admins.find((admin) => admin._id.toString() === userId);
    for (const member of members) {
      const user = updatedChat.membersList.find((mbr) => mbr._id.toString() === member._id.toString());
      const newMessage = {
        senderId: userId,
        deviceId: userLoggedIn.deviceId,
        userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
        message: `${user.firstName} has been added.`,
        createdAt: Firestore.FieldValue.serverTimestamp(),
        type: 'notification',
      };
      const chatRef = db.collection('chats').doc(chatId);
      await chatRef.collection('messages').add(newMessage);
    }

    await addPlayersToMatches(addMembers, chatId);

    res.status(200).send({ chat: updatedChat, message: 'New member(s) added successfully.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const removeMember = async (req,res) => {
  const { chatId } = req.params;
  const { memberId } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne(
      { 
        _id: chatId, 
        'deleted.isDeleted': false,
        isPrivate: false
      }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to remove a member.' });
    const playerStatus = await checkPlayerInMatches(res, memberId, chatId);
    if (!playerStatus) return;
    const admin = chat.admins.find((admin) => admin.toString() === memberId);
    const update = admin ? { $pull: { admins: memberId } } : { $pull: { membersList: memberId } };
    const options = { new: true };
    const updatedChat = await Chat.findByIdAndUpdate( chatId, update, options )
      .populate('admins', 'firstName lastName phone profileUrl deviceId')
      .populate('membersList', 'firstName lastName phone profileUrl deviceId');
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const userLoggedIn = updatedChat.admins.find((admin) => admin._id.toString() === userId);
    const removedUser = await User.findOne({ _id: memberId }, '-deleted -__v');
    const newMessage = {
      senderId: userId,
      deviceId: userLoggedIn.deviceId,
      userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
      message: `${removedUser.firstName} has been removed.`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    res.status(200).send({ chat: updatedChat, message: 'Member removed successfully.' });
    
    return new Promise(async () => {
      await removePlayerFromMatches(memberId, chatId);
    });
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
    const chat = await Chat.findOne(
      { 
        _id: chatId, 
        'deleted.isDeleted': false,
        isPrivate: false
      }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    const member = chat.membersList.find((member) => member.toString() === memberId);
    if (!member)
      return res
        .status(404)
        .send({ error: 'This person is not part of the chat group.' });
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId, 
      {
        $pull: { membersList: memberId },
        $push: { admins: member },
      },
      { new: true })
        .populate('admins', 'firstName lastName phone profileUrl deviceId')
        .populate('membersList', 'firstName lastName phone profileUrl deviceId');
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const userLoggedIn = updatedChat.admins.find((admin) => admin._id.toString() === userId);
    const newAdmin = updatedChat.admins.find((mbr) => mbr._id.toString() === memberId);
    const newMessage = {
      senderId: userId,
      deviceId: userLoggedIn.deviceId,
      userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
      message: `${newAdmin.firstName} is now an admin.`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
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
    const chat = await Chat.findOne(
      { 
        _id: chatId, 
        'deleted.isDeleted': false,
        isPrivate: false
      }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins can perform this action.' });
    const member = chat.admins.find((admin) => admin.toString() === memberId);
    if (!member)
      return res
        .status(404)
        .send({ error: 'This person is not part of the chat group.' });
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId, 
      {
        $push: { membersList: member },
        $pull: { admins: memberId },
      },
      { new: true })
        .populate('admins', 'firstName lastName phone profileUrl deviceId')
        .populate('membersList', 'firstName lastName phone profileUrl deviceId');
    if (!updatedChat)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const userLoggedIn = updatedChat.admins.find((admin) => admin._id.toString() === userId);
    const removedAdmin = updatedChat.membersList.find((mbr) => mbr._id.toString() === memberId);
    const newMessage = {
      senderId: userId,
      deviceId: userLoggedIn.deviceId,
      userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
      message: `${removedAdmin.firstName} is no longer an admin.`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
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
    const timeStamp = Firestore.FieldValue.serverTimestamp();
    const userLoggedIn = await User.findOne({ _id: userId }, '-deleted -__v');
    const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chat) 
      return res
        .status(404)
        .send({ error: 'Chat was not found.' });
    if (chat.isPrivate)
      return res
        .status(404)
        .send({ error: 'Unable to perform action in private chat.' });
    if (chat.deleted.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const playerStatus = await checkPlayerInMatches(res, userId, chatId);
    if (!playerStatus) return;
    const isAdmin = chat.admins.includes(userId);
    const isMember = chat.membersList.includes(userId);
    if (isAdmin) {
      const randomIndex = Math.floor(Math.random() * (chat.membersList.length - 1));
      const newAdmin = chat.membersList[randomIndex];
      if (chat.admins.length === 1) {
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
          $pull: {
            admins: userId,
            membersList: newAdmin,
          }}, { new: true });
        updatedChat.admins.push(newAdmin);
        updatedChat.save();
        await updatedChat.populate('admins', 'firstName lastName phone profileUrl deviceId')
          .populate('membersList', 'firstName lastName phone profileUrl deviceId')
          .execPopulate();
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      const newMessage = {
        senderId: userId,
        deviceId: userLoggedIn.deviceId,
        userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
        message: `${userLoggedIn.firstName} has left the chat.`,
        createdAt: timeStamp,
        type: 'notification',
      };
      const chatRef = db.collection('chats').doc(chatId);
      await chatRef.collection('messages').add(newMessage);
      res.status(200).send({ message: 'Left chat successfully.' });
      return new Promise(async () => {
        await removePlayerFromMatches(userId, chatId);
      });
      } else {
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
          $pull: { admins: userId },
        }, { new: true }).populate('admins', 'firstName lastName phone profileUrl deviceId')
          .populate('membersList', 'firstName lastName phone profileUrl deviceId');;
        if (!updatedChat)
          return res
            .status(404)
            .send({ error: 'Something went wrong please try again later.' });
        const newMessage = {
          senderId: userId,
          deviceId: userLoggedIn.deviceId,
          userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
          message: `${userLoggedIn.firstName} has left the chat.`,
          createdAt: timeStamp,
          type: 'notification',
        };
        const chatRef = db.collection('chats').doc(chatId);
        await chatRef.collection('messages').add(newMessage);
        res.status(200).send({ message: 'You have left chat group successfully.' });
        return new Promise(async () => {
          await removePlayerFromMatches(userId, chatId);
        });
      }
    } else if (isMember) {
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $pull: { membersList: userId },
      }, { new: true }).populate('admins', 'firstName lastName phone profileUrl deviceId')
        .populate('membersList', 'firstName lastName phone profileUrl deviceId');;
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
        const newMessage = {
          senderId: userId,
          deviceId: userLoggedIn.deviceId,
          userName: `${userLoggedIn.firstName} ${userLoggedIn.lastName}`,
          message: `${userLoggedIn.firstName} has left the chat.`,
          createdAt: timeStamp,
          type: 'notification',
        };
        const chatRef = db.collection('chats').doc(chatId);
        await chatRef.collection('messages').add(newMessage);
      res.status(200).send({ message: 'Left chat successfully.' });
      return new Promise(async () => {
        await removePlayerFromMatches(userId, chatId);
      });
    } else {
        return res
          .status(404)
          .send({ error: 'You are no longer a part of this chat.' });
    }
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteChat = async (req, res) => {
  const { chatIds } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    for (const chatId of chatIds) {
      const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
      if (!chat) 
        return res
          .status(404)
          .send({ error: 'Chat was not found.' });
      if (chat.deleted.isDeleted)
        return res
          .status(404)
          .send({ error: 'Chat is already deleted.' });
      const isAdmin = chat.admins.find((admin) => admin.toString() === userId);
      if (!isAdmin)
        return res
          .status(404)
          .send({ error: 'Only admins can perform this action.' });
      if (!chat.isPrivate) {
        await deleteFromBucket(chat.chatImage);
      const deleteChat = await Chat.findByIdAndUpdate(
        chatId,
        { deleted: { isDeleted: true, date: new Date() }, },
        { new: true }
      );
      if (!deleteChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      await db.collection('chats').doc(chatId).update({
        deleted: true,
      });
      }
    }
    res.status(201).send({ message: 'Chats have been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
