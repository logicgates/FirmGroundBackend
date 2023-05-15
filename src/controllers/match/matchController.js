import { errorMessage } from '../../config/config.js';
import User from '../../models/user/User.js';
import Match from '../../models/match/Match.js';
import Chat from '../../models/chat/ChatModel.js';
import { matchSchema, updateMatchSchema } from '../../schema/match/matchSchema.js'
import db from '../../config/firebaseConfig.js';

export const createMatch = async (req, res) => {
  const { chatId, costPerPerson, title } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    await matchSchema.validate(req.body);
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-deleted -__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to create a match.' });
    const alreadyExist = await Match.findOne()
      .and([ { title: title }, { chatId: chatId } ])
      .exec();
    if (alreadyExist)
      return res
        .status(400)
        .send({ error: 'Match with that title already exists.' });
    const match = await Match.create({
      ...req.body,
      chatId: chatId,
      players: [],
      activePlayers: [],
      teamA: [],
      teamB: [],
      cost: 0,
      collected: 0,
      lockTimer: '',
      isCancelled: false,
      isLocked: false,
      creationDate: new Date(),
    });
    const chatMembers = [...chat.admins, ...chat.membersList];
    const players = await User.find({ _id: { $in: chatMembers } }, 'firstName lastName');
    match.players = players.map(player => ({
      _id: player._id,
      name: `${player.firstName} ${player.lastName}`,
      participationStatus: 'pending',
      payment: 'unpaid',
    }));
    match.cost = (costPerPerson || 0) * match.players.length;
    await match.updateLockTimer();
    match.save();
    // Last message for chat is updated
    const user = await User.findOne({ _id: userId }, '-deleted -__v');
    const newMessage = {
      userId: userId,
      userName:`${user.firstName} ${user.lastName}`,
      message: `Match was created by ${user.firstName}`,
      createdAt: new Date().toString(),
      isNotif: true,
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    chat.lastMessage = newMessage;
    chat.save();
    res.status(201).send({ match, message: 'Match has been created.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getAllMatches = async (req, res) => {
  const { chatId } = req.params
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-deleted -__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin._id === userId);
    const isMember = chat.membersList.some((member) => member._id === userId);
    if (!isMember && !isAdmin)
      return res
        .status(404)
        .send({ error: 'You are not a part of this chat group.' });
    const groupMatches = await Match.find({ chatId });
    if (!groupMatches)
      return res
        .status(404)
        .send({ error: 'No matches found for the chat group.' });
    await Promise.all(groupMatches.map(async (match) => {
      await match.updateLockTimer();
      await match.updatePaymentCollected();
    }));
    res.status(200).send({ groupMatches });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getActivePlayers = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat is unavailable.' });
  const isAdmin = chat.admins.some((admin) => admin._id === userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to add players.' });
  res.status(200).send({ players: match.activePlayers });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updateMatch = async (req, res) => {
  const { matchId } = req.params;
  const updateBody = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
  await updateMatchSchema.validate(updateBody);
  const chat = await Chat.findOne({ _id: updateBody.chatId, 'deleted.isDeleted': false }, '-__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat is unavailable.' });
  const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match is closed.' });
  const isAdmin = chat.admins.some((admin) => admin._id === userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update match details.' });
  const updateMatch = await Match.findByIdAndUpdate(
    matchId,
    {
      ...updateBody,
      lockTimer: '',
    }, 
    { new: true }
  );
  await updateMatch.updatePaymentCollected();
  await updateMatch.updateLockTimer();
  if (!updateMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  res.status(200).send({ match: updateMatch, message: 'Match has been updated.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updateParticiationStatus = async (req,res) => {
  const { matchId } = req.params;
  const { status } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    const user = await User.findOne({ _id: userId }, '-__v');
    if (!user)
      return res
        .status(404)
        .send({ error: 'User timeout. Please login and try again.' });
    const player = match.players.some( player => player._id === userId );
    if (!player)
      return res
        .status(404)
        .send({ error: 'You are not a part of this match.' });
    const isActivePlayer = match.activePlayers.find(player => player._id === userId);
    const isInTeam = match.teamA.some((player) => player._id === userId) || match.teamB.some((player) => player._id === userId);
    if (isInTeam)
      return res
        .status(403)
        .send({ error: 'You are already a part of a team.' });
    if (!match.isOpenForPlayers())
      return res
        .status(403)
        .send({ error: 'The match is no longer accepting new players.' });
    const update = { 'players.$[elem].participationStatus': status };
    const options = { arrayFilters: [{ 'elem._id': userId }], new: true };
    if (!isActivePlayer && status === 'in') {
      update['$push'] = { 
        activePlayers: {
          _id: userId,
          name: `${user.firstName} ${user.lastName}`,
          phone: user.phone,
          profileUrl: user.profileUrl,
        }
      };
    } else if (isActivePlayer && status === 'out') {
      const hasPaid = match.players.find((player) => player._id === userId)?.payment === 'paid';
      if (hasPaid) {
        return res
          .status(403)
          .send({ error: 'Unable to leave after payment completed.' });
      }
      else {
        update['$pull'] = { activePlayers: { _id: userId } };
      }
    }
    const updatedMatch = await Match.findByIdAndUpdate(matchId, update, options);
    await updatedMatch.updatePaymentCollected();
    if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ match: updatedMatch, message: 'Player participation status has been updated.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updatePaymentStatus = async (req,res) => {
  const { matchId } = req.params;
  const { payment, memberId } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
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
    const isAdmin = chat.admins.some((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to update payment.' });
    let updatedMatch = match;
    if (player.participationStatus === 'in') {
      const update = { 'players.$[elem].payment': payment };
      const options = { arrayFilters: [{ 'elem._id': memberId }], new: true };
      updatedMatch = await Match.findByIdAndUpdate(matchId, update, options);
      if (!updatedMatch)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
    } else {
      return res
        .status(403)
        .send({ error: 'Player is not active.' });
    }
    res.status(200).send({ match: updatedMatch, message: 'Player payment status has been updated.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const addPlayerToTeam = async (req, res) => {
  const { matchId } = req.params;
  const { chatId, team, members } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
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
  const isAdmin = chat.admins.some((admin) => admin._id === userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to add players.' });
  if (members.length === 0)
    return res
      .status(404)
      .send({ error: `None selected to add to team-${team}.` });
  const newTeamMembers = [];
  members.forEach(memberId => {
    let foundPlayer = match.activePlayers.find(player => player._id.toString() === memberId.toString());
    if (foundPlayer && !match[`team${team}`].some(player => player._id.toString() === memberId.toString())) {
      newTeamMembers.push(foundPlayer);
    }
  });
  const updatedMatch = await Match.findByIdAndUpdate(
    matchId,
    { 
      $push: { [`team${team}`]: { $each: newTeamMembers } },
      $pull: { activePlayers: { _id: { $in: members } } },
    },
    { new: true },
  );
  if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  res.status(200).send({ match: updatedMatch, message: `Player added to team ${team}.` });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const removePlayerFromTeam = async (req, res) => {
  const { matchId } = req.params;
  const { chatId, team, memberId } = req.body;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
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
  const isAdmin = chat.admins.some((admin) => admin._id === userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to remove players.' });
  const teamPlayers = ( team === 'A' ? match.teamA : match.teamB );
  const foundPlayer = teamPlayers.find((player) => player._id === memberId);
  if (!foundPlayer)
    return res
      .status(404)
      .send({ error: `Unable to find player of team-${team}.` });
  const updatedMatch = await Match.findByIdAndUpdate(
    matchId,
    { 
      $push: { activePlayers: foundPlayer },
      $pull: { [`team${team}`]: { _id: memberId } },
    },
    { new: true },
  );
  if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  res.status(200).send({ match: updatedMatch, message: `Player removed from team ${team}.` });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const cancelMatch = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
  const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match is closed.' });
  const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat is unavailable.' });
  const isAdmin = chat.admins.some((admin) => admin._id === userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to cancel a match.' });
  const cancelMatch = await Match.findByIdAndUpdate(
    matchId,
    { isCancelled: true },
    { new: true }
    );
  if (!cancelMatch)
    return res
      .status(404)
      .send({ error: 'Something went wrong please try again later.' });
  res.status(201).send({ match: cancelMatch,  message: 'Match has been cancelled.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteMatch = async (req, res) => {
  const { matchId } = req.params;
  const userId = req.session.userInfo?.userId;
  if (!userId)
      return res
        .status(401)
        .send({ error: 'User timeout. Please login again.' });
  try {
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-__v');
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin._id === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to delete a match.' });
    const deleteMatch = await Match.findByIdAndDelete(matchId);
    if (!deleteMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    res.status(201).send({ message: 'Match has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
