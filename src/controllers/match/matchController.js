import { errorMessage } from '../../config/config.js';
import User from '../../models/user/User.js';
import Match from '../../models/match/Match.js';
import Chat from '../../models/chat/ChatModel.js';
import { 
  addPlayerToTeamSchema,
  matchSchema, 
  updateMatchSchema, 
  updateParticiationStatusSchema, 
  updatePaymentStatusSchema
} from '../../schema/match/matchSchema.js'
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
    const [chat, user] = await Promise.all([
      Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-deleted -__v'),
      User.findOne({ _id: userId }, '-deleted -__v')
    ]);
    if (!chat)
      return res
        .status(404)
        .send({ error: 'Chat is unavailable.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
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
        player: playerId,
        participationStatus: 'pending',
        isActive: false,
        payment: 'unpaid',
        team: ''
      })),
      cost: (costPerPerson || 0) * players.length,
      collected: 0,
      lockTimer: '',
      isCancelled: false,
      isLocked: false,
      creationDate: new Date(),
    });
    await match.updateLockTimer();
    const newMessage = {
      senderId: userId,
      userName: `${user.firstName} ${user.lastName}`,
      message: `Match was created by ${user.firstName}`,
      createdAt: new Date().toUTCString(),
      type: 'notification',
    };
    const chatRef = db.collection('chats').doc(chatId);
    await chatRef.collection('messages').add(newMessage);
    chat.lastMessage = newMessage;
    await chat.save();
    await match.populate('players.player', '-_id firstName lastName phone profileUrl');
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
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    const isMember = chat.membersList.some((member) => member.toString() === userId);
    if (!isMember && !isAdmin)
      return res
        .status(404)
        .send({ error: 'You are not a part of this chat group.' });
    const groupMatches = await Match.find({ chatId })
      .populate('players.player', '-_id firstName lastName phone profileUrl');
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
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v')
    .populate('players.player', '-_id firstName lastName phone profileUrl');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const chat = await Chat.findOne({ _id: match.chatId, 'deleted.isDeleted': false }, '-deleted -__v');
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
  const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
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
  ).populate('players.player', '-_id firstName lastName phone profileUrl');
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
    await updateParticiationStatusSchema.validate(req.body);
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    if (!match.isOpenForPlayers())
      return res
        .status(403)
        .send({ error: 'The match is no longer accepting new players.' });
    const player = match.players.find( player => player._id === userId );
    console.log(player)
    if (!player)
      return res
        .status(404)
        .send({ error: 'You are not a part of this match.' });
    if (player.team === 'A' || player.team === 'B')
      return res
        .status(403)
        .send({ error: 'You are already a part of a team.' });
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
      .populate('players.player', '-_id firstName lastName phone profileUrl');
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
    await updatePaymentStatusSchema.validate(req.body);
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
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to update payment.' });
    if (!player.isActive) 
      return res
          .status(403)
          .send({ error: 'Player is not active.' });
    if (player.payment === 'paid')
      return res
        .status(403)
        .send({ error: 'Player has already paid.' });
    const update = { 'players.$[elem].payment': payment };
    const options = { arrayFilters: [{ 'elem._id': memberId }], new: true };
    const updatedMatch = await Match.findByIdAndUpdate(matchId, update, options)
      .populate('players.player', '-_id firstName lastName phone profileUrl');
    await updatedMatch.updatePaymentCollected();
    if (!updatedMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
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
    await addPlayerToTeamSchema.validate(req.body);
    const chat = await Chat.findOne({ _id: chatId, 'deleted.isDeleted': false }, '-__v');
      if (!chat)
        return res
          .status(404)
          .send({ error: 'Chat is unavailable.' });
    const match = await Match.findOne({ _id: matchId, isCancelled: false, isLocked: false }, '-__v')
      .populate('players.player', '-_id firstName lastName phone profileUrl');
    if (!match)
      return res
        .status(404)
        .send({ error: 'Match is closed.' });
    const isAdmin = chat.admins.some((admin) => admin.toString() === userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to add players.' });
    for (const member of members) {
      const player = match.players.find((player) => player._id === member);
      if (!player.isActive) 
        return res
            .status(403)
            .send({ error: `Player '${player.player.firstName} ${player.player.lastName}' is not active.` });
    };
    if (members.length === 0)
      return res
        .status(404)
        .send({ error: `None selected to add to team-${team}.` });
    const filter = { _id: matchId };
    const update = { 'players.$[elem].team': team };
    const options = { arrayFilters: [{ 'elem._id': userId }], new: true };
    const updatedMatch = await Match.findByIdAndUpdate(filter, update, options)
      .populate('players.player', '-_id firstName lastName phone profileUrl');
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
