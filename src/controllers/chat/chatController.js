import { errorMessage } from '../../config/config.js';
import Chat from '../../models/chat/ChatModel.js';
import User from '../../models/user/User.js';
import { deleteFromBucket, addToBucket } from '../../config/awsConfig.js';
import db from '../../config/firebaseConfig.js';

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
        { membersList: { $elemMatch: { _id: userId } } },
        { membersList: { $elemMatch: { _id: parsedMembers[0]._id } } },
        { isPrivate: true },
        { isDeleted: false }
    ]
    }, '-__v');
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
    const fileName = req.file ? await addToBucket(req.file, 'chat') : '';
    const memberIds = isPrivate ? [userObj._id, parsedMembers[0]._id] : parsedMembers.map(member => member._id);
    const newChat = await Chat.create({
      title: isPrivate ? 'Private chat' : title,
      admins: isPrivate ? [] : userObj._id,
      membersList: memberIds,
      creationDate: new Date(),
      chatImage: fileName,
      isPrivate,
      deleted: {},
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

    newChat.title = isPrivate ? `${parsedMembers[0].firstName} ${parsedMembers[0].lastName}` : newChat.title;
    await newChat.populate('admins', 'firstName lastName phone profileUrl');
    await newChat.populate('membersList', 'firstName lastName phone profileUrl');
    newChat.admins.map(admin => ({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      profileUrl: admin.profileUrl,
    }));
    newChat.membersList.map(member => ({
      _id: member._id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      profileUrl: member.profileUrl,
    }));

    res.status(201).send({ chat: newChat, message: 'Chat created.' });
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
    const chat = await Chat.findById(chatId, '-deleted -__v')
      .populate('admins', 'firstName lastName phone profileUrl')
      .populate('membersList', 'firstName lastName phone profileUrl');
    if (!chat)
      return res.status(404).send({ error: 'No chats were found.' });
    chat.admins.map((admin) => ({
      _id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      profileUrl: admin.profileUrl,
    }));
    chat.membersList.map((member) => ({
      _id: member._id,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      profileUrl: member.profileUrl,
    }));
    if (chat.isPrivate) {
      const member = chat.membersList.find((member) => member._id.toString() !== userId);
      chat.title = `${member.firstName} ${member.lastName}`;
    }
    chat.lastMessage = 'Start chatting...';
    const chatRef = db.collection('chats').doc(chat.id);
    const messagesSnapshot = await chatRef
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!messagesSnapshot.empty)
      chat.lastMessage = messagesSnapshot.docs[0].data();
    res.status(200).send({ chat });
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
        $and: [{ 'deleted.isDeleted': false }]
      }, '-deleted -__v');
    if (!chats) 
      return res
        .status(404)
        .send({ error: 'No chats were found.' });
    for (const chat of chats) {
      if (chat.isPrivate) {
        const member = chat.membersList.find((member) => member._id !== userId);
        chat.title = `${member.firstName} ${member.lastName}`;
      }
      chat.lastMessage = 'Start chatting...';
      const chatRef = db.collection('chats').doc(chat.id);
      const messagesSnapshot = await chatRef
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!messagesSnapshot.empty) 
        chat.lastMessage = messagesSnapshot.docs[0].data();
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
    if (chat.deleted.isDeleted)
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
    if (chat.deleted.isDeleted)
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
    if (chat.deleted.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to remove a member.' });
    const admin = chat.admins.find((admin) => admin._id === memberId);
    const update = admin ? { $pull: { admins: { _id: memberId } } } : { $pull: { membersList: { _id: memberId } } };
    const options = { new: true };
    const updatedChat = await Chat.findByIdAndUpdate( chatId, update, options );
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
    if (chat.deleted.isDeleted)
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
    if (chat.deleted.isDeleted)
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
    if (chat.deleted.isDeleted)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.find((admin) => admin._id === userId);
    const isMember = chat.membersList.find((member) => member._id === userId);
    if (isAdmin) {
      const randomIndex = Math.floor(Math.random() * (chat.membersList.length - 1));
      const newAdmin = chat.membersList[randomIndex];
      if (chat.admins.length === 1) {
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
          $pull: { 
            admins: { _id: userId },
            membersList: { _id: newAdmin._id },
          }
        });
        updatedChat.admins.push(newAdmin);
        updatedChat.save();
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ message: 'Left chat successfully.' });
      } else {
        const updatedChat = await Chat.findByIdAndUpdate(chatId, {
          $pull: { admins: { _id: userId } },
        });
        if (!updatedChat)
          return res
            .status(404)
            .send({ error: 'Something went wrong please try again later.' });
        res.status(200).send({ message: 'You have left chat group successfully.' });
      }
    } else if (isMember) {
      const updatedChat = await Chat.findByIdAndUpdate(chatId, {
        $pull: { membersList: { _id: userId } },
      });
      if (!updatedChat)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
      res.status(200).send({ chat: updatedChat, message: 'Left chat successfully.' });
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
    if (chat.deleted.isDeleted)
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
    { deleted: { isDeleted: true, date: new Date() }, },
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
