import { errorMessage } from '../../config/config.js';
import Match from '../../models/match/Match.js';
import Chat from '../../models/chat/ChatModel.js';
import { 
  addPlayerToTeamSchema,
  matchSchema, 
  updateAdditionalPlayerSchema, 
  updateMatchSchema, 
  updateParticiationStatusSchema, 
  updatePaymentStatusSchema
} from '../../schema/match/matchSchema.js'
import db from '../../config/firebaseConfig.js';
import Firestore from '@google-cloud/firestore';
import mongoose from 'mongoose';

const calculateStatusCounts = async (groupMatches, userId, chatId) => {

  const matches =
    groupMatches !== undefined
      ? groupMatches
      : await Match.find({ chatId, 'deleted.isDeleted': false, isCancelled: false }, 'players');

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

export const createMatch = async (req, res) => {
  const { chatId, costPerPerson, title, teamCount } = req.body;
  const userInfo = req.userInfo;
  try {
    await matchSchema.validate(req.body);
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to create a match.' });
    const matchExist = await Match.exists({ title: title, chatId: chatId });
    if (matchExist)
      return res
        .status(400)
        .send({ error: 'Match with that title already exists.' });
    const players = [...chat.admins, ...chat.membersList];
    const match = await Match.create({
      ...req.body,
      chatId,
      players: players.map(playerId => ({
        _id: playerId._id,
        info: playerId,
        participationStatus: 'pending',
        isActive: false,
        payment: 'unpaid',
        team: '',
        addition: 0
      })),
      maxPlayers: teamCount ? 2 * parseInt(teamCount) : 11,
      inPlayerCount: players.length,
      cost: (costPerPerson || 0) * players.length,
      collected: 0,
      lockTimer: '',
      isCancelled: false,
      isLocked: false,
      creationDate: new Date(),
      deleted: {}
    });
    await match.updateLockTimer();
    const newMessage = {
      senderId: userInfo?.userId,
      deviceId: userInfo?.deviceId === undefined ? '000' : userInfo?.deviceId,
      userName: `${userInfo?.firstName} ${userInfo?.lastName}`,
      message: `Match was created by ${userInfo?.firstName}`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    chat.matchExist = true;
    await chat.save();
    await match.populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    const statusCount = await calculateStatusCounts(undefined, userInfo?.userId, chatId);
    res.status(201).send({ 
      match, 
      message: 'Match has been created.',
      statusCount
    });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getAllMatches = async (req, res) => {
  const { chatId } = req.params
  const userId = req.userInfo?.userId;
  try {
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    const isMember = chat.membersList.some((member) => member.toString() === userId);
    if (!isMember && !isAdmin)
      return res
        .status(404)
        .send({ error: 'You are not a part of this chat group.' });
    const groupMatches = await Match.find({ chatId, 'deleted.isDeleted': false }, '-__v')
      .populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    if (!groupMatches)
      return res
        .status(404)
        .send({ error: 'No matches found for the chat group.' });

    const statusCount = await calculateStatusCounts(groupMatches, userId, chatId);
    res.status(200).send({ groupMatches, statusCount });
    return await Promise.all(
      groupMatches.map(async (match) => {
        await match.updatePlayerCount();
        await match.updateLockTimer();
        await match.updatePaymentCollected();
      })
    );
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getActivePlayers = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.userInfo?.userId;
  try {
  const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v')
    .populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match is closed.' });
  if (match.deleted?.isDeleted)
    return res
      .status(404)
      .send({ error: 'Match is unavaliable.' });
  const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat is unavailable.' });
  const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to add players.' });
  const activePlayers = match.players.filter(player => player.isActive === true);
  res.status(200).send({ players: activePlayers });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updateMatch = async (req, res) => {
  const { matchId } = req.params;
  const { chatId } = req.body;
  const userInfo = req.userInfo;
  try {
    await updateMatchSchema.validate(req.body);
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to update match details.' });
    const updateMatch = await Match.findByIdAndUpdate(
      matchId,
      {
        ...req.body,
        lockTimer: '',
      }, 
      { new: true }
    ).populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    if (!updateMatch)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
    const newMessage = {
      senderId: userInfo?.userId,
      deviceId: userInfo?.deviceId ? '000' : userInfo?.deviceId,
      userName: `${userInfo?.firstName} ${userInfo?.lastName}`,
      message: `Match '${updateMatch.title}' was updated by ${userInfo?.firstName}`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    await updateMatch.updatePaymentCollected();
    await updateMatch.updatePlayerCount();
    await updateMatch.updateLockTimer();
    res.status(200).send({ match: updateMatch, message: 'Match has been updated.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updatePlayerAddition = async (req,res) => {
  const { matchId } = req.params;
  const { task } = req.body;
  const userId = req.userInfo?.userId;
  try {
    await updateAdditionalPlayerSchema.validate(req.body);
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    if (!match.isOpenForPlayers())
      return res
        .status(403)
        .send({ error: 'The match is no longer accepting new players.' });
    const player = match.players.find((player) => (player._id === userId && player.number === 0));
    if (!player)
      return res
        .status(404)
        .send({ error: 'You are not a part of this match.' });
    if (player.payment === 'paid')
      return res
        .status(403)
        .send({ error: 'Changes cannot be made after payment.' });
    if (player.addition === 0 && task === 'remove')
      return res
        .status(403)
        .send({ error: 'No additional players to remove.' });
    if (match.maxPlayers === match.inPlayerCount)
      return res
        .status(403)
        .send({ error: 'Max players for this match has reached.' });
  
    const total = task === 'add' ? player.addition + 1 : player.addition - 1;
    const update = { 'players.$[elem].addition': total };
    const options = { arrayFilters: [{ 'elem._id': userId }], new: true };
    const updatedMatch = await Match.findByIdAndUpdate(matchId, update, options);

    if (task === 'add') {
      const newPlayer = {
        _id: new mongoose.Types.ObjectId(),
        parentId: player._id,
        info: player.info,
        participationStatus: 'in',
        isActive: true,
        payment: 'unpaid',
        team: '',
        number: player.addition + 1
      };
    
      updatedMatch.players.push(newPlayer);
      await updatedMatch.save();
    } else if (task === 'remove' && player.addition > 0) {
      updatedMatch.players = updatedMatch.players.filter(
        (p) => !(p.parentId === player._id && p.number === player.addition)
      );
      await updatedMatch.save();
    } else {
      return res.status(404).send({ error: 'Task should be add or remove only.' });
    }

    await updatedMatch.populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    await updatedMatch.updatePlayerCount();
    await updatedMatch.updatePaymentCollected();
    const action = task === 'add' ? 'added' : 'removed';
    res.status(200).send({ match: updatedMatch, message: `Additional player has been ${action}` });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updateParticiationStatus = async (req,res) => {
  const { matchId } = req.params;
  const { status } = req.body;
  const userId = req.userInfo?.userId;
  try {
    await updateParticiationStatusSchema.validate(req.body);
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v')
      .populate('players.info', '-_id firstName lastName deviceId');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    await match.updateLockTimer();
    if (!match.isOpenForPlayers())
      return res
        .status(403)
        .send({ error: 'The match is no longer accepting new players.' });
    const player = match.players.find((player) => player._id === userId);
    if (!player)
      return res
        .status(404)
        .send({ error: 'You are not a part of this match.' });
    if (player.team === 'A' || player.team === 'B')
      return res
        .status(403)
        .send({ error: 'You are already a part of a team.' });
    if (player.participationStatus === status)
      return res
        .status(403)
        .send({ error: `Status already set to ${player.participationStatus}.` });
    if (match.maxPlayers === match.inPlayerCount)
      return res
        .status(403)
        .send({ error: 'Max players for this match has reached.' });
    const filter = { _id: matchId };
    const update = { 'players.$[elem].participationStatus': status };
    const options = { arrayFilters: [{ 'elem._id': userId }], new: true };
    if (!player.isActive && status === 'in') {
      update['$set'] = { 'players.$[elem].isActive': true };
    } else if (player.isActive && status === 'out') {
      if (player.payment === 'paid') {
        return res
          .status(403)
          .send({ error: 'Unable to leave after payment completed.' });
      }
      else {
        update['$set'] = { 'players.$[elem].isActive': false };
      }
    }
    const updatedMatch = await Match.findOneAndUpdate(filter, update, options)
      .populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const chatId = match.chatId.toString();
    const newMessage = {
      senderId: userId,
      deviceId: player.info.deviceId,
      userName: `${player.info.firstName} ${player.info.lastName}`,
      message: `${player.info.firstName} updated status to '${status}' for match '${updatedMatch.title}'.`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    await updatedMatch.updatePaymentCollected();
    await updatedMatch.updatePlayerCount();
    const statusCount = await calculateStatusCounts(undefined, userId, chatId);
    res.status(200).send({ 
      match: updatedMatch, 
      message: 'Player participation status has been updated.', 
      statusCount
    });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updatePaymentStatus = async (req,res) => {
  const { matchId } = req.params;
  const { payment, memberId } = req.body;
  const userId = req.userInfo?.userId;
  try {
    await updatePaymentStatusSchema.validate(req.body);
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    const player = match.players.find((player) => player._id === memberId);
    if (!player)
      return res
        .status(404)
        .send({ error: 'Player is not a part of this match.' });
    const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    if (!player.isActive) 
      return res
          .status(403)
          .send({ error: 'Player is not active.' });
    const update = { 'players.$[elem].payment': payment };
    const options = { arrayFilters: [{ 'elem._id': memberId }], new: true };
    const updatedMatch = await Match.findByIdAndUpdate(matchId, update, options)
      .populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    await updatedMatch.updatePaymentCollected();
    if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    await updatedMatch.updateLockTimer();
    res.status(200).send({ match: updatedMatch, message: 'Player payment status has been updated.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const addPlayersToTeam = async (req, res) => {
  const { matchId } = req.params;
  const { chatId, team, members } = req.body;
  const userId = req.userInfo?.userId;
  try {
    await addPlayerToTeamSchema.validate(req.body);
    if (members.length === 0)
      return res
        .status(404)
        .send({ error: `None selected to add to team-${team}.` });
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
      if (!chat)
        return res
          .status(404)
          .send({ error: 'Chat is unavailable.' });
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v')
      .populate('players.info', '-_id firstName lastName phone profileUrl deviceId');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to add players.' });
    
    let updatedMatch = {};
    const filter = { _id: matchId };
    const update = { 'players.$[elem].team': team };
    for (const member of members) {
      const options = { arrayFilters: [{ 'elem._id': member }], new: true };
      updatedMatch = await Match.findByIdAndUpdate(filter, update, options);
    };
    if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    
    await updatedMatch.populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    await updatedMatch.updateLockTimer();
    res.status(200).send({ match: updatedMatch, message: `Player(s) added to team ${team}.` });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const removePlayerFromTeam = async (req, res) => {
  const { matchId } = req.params;
  const { chatId, team, memberId } = req.body;
  const userId = req.userInfo?.userId;
  try {
    await addPlayerToTeamSchema.validate(req.body);
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to remove players.' });
    const filter = { _id: matchId };
    const update = { 'players.$[elem].team': '' };
    const options = { arrayFilters: [{ 'elem._id': memberId }], new: true };
    const updatedMatch = await Match.findByIdAndUpdate(filter, update, options)
      .populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    await updatedMatch.updateLockTimer();
    res.status(200).send({ match: updatedMatch, message: `Player removed from team ${team}.` });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const cancelMatch = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.userInfo?.userId;
  try {
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match is unavaliable.' });
    const chatId = match.chatId.toString();
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat not found.' });
    const admin = chat.admins.find((admin) => admin.toString() === userId);
    if (!admin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to cancel a match.' });
    const cancelMatch = await Match.findByIdAndUpdate(
      matchId,
      { 
        isCancelled: true,
        isLocked: true,
        lockTimer: '0',
      },
      { new: true }
      ).populate('players.info', '-_id firstName lastName phone profileUrl deviceId addition');
    if (!cancelMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    const newMessage = {
      senderId: userId,
      deviceId: admin.deviceId === undefined ? '000' : admin.deviceId,
      userName: `${admin.firstName} ${admin.lastName}`,
      message: `${admin.firstName} cancelled the match '${cancelMatch.title}'`,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    res.status(201).send({ match: cancelMatch,  message: 'Match has been cancelled.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteMatch = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.userInfo?.userId;
  try {
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (match.deleted?.isDeleted)
      return res
        .status(404)
        .send({ error: 'Match has already been deleted.' });
    const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to delete a match.' });
    const deleteMatch = await Match.findByIdAndUpdate(matchId, 
      { 
        deleted: { isDeleted: true, date: new Date() },
        isLocked: true,
        lockTimer: '0', 
      }
    );
    if (!deleteMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(201).send({ message: 'Match has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
