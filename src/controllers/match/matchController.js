import { errorMessage } from '../../config/config.js';
import User from '../../models/user/User.js';
import Match from '../../models/match/Match.js';
import Chat from '../../models/chat/ChatModel.js';
import { matchSchema, updateMatchSchema } from '../../schema/chat/chatSchema.js'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/awsConfig.js';
import sharp from 'sharp';
import crypto from 'crypto';
import moment from 'moment';

const bucketName = process.env.S3_BUCKET_NAME;

export const createMatch = async (req, res) => {
  const userInfo = req.session.userInfo;
  const updateBody = req.body;
  try {
    await matchSchema.validate(req.body);
    const chatGroup = await Chat.findOne({ _id: updateBody.chatId }, '-deleted -__v');
    if (!chatGroup)
      return res
        .status(404)
        .send({ error: 'Chat group was not found.' });
    let isAdmin = chatGroup.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to create a match.' });
    let alreadyExist = await Match.findOne()
      .and([ { title: updateBody.title }, { chatId: updateBody.chatId } ])
      .exec();
    if (alreadyExist)
      return res
        .status(400)
        .send({ error: 'Match with that title already exists.' });
    let imageUrl = '';
    let fileName = '';
    if (req.file) {
      fileName = crypto.randomBytes(32).toString('hex');
      const fileMimetype = req.file?.mimetype.split('/')[1];
      const buffer = await sharp(req.file?.buffer)
        .resize({ width: 960, height: 540, fit: 'contain' })
        .toBuffer();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `match/${fileName}.${fileMimetype}`,
        Body: buffer,
        ContentType: req.file?.mimetype,
      });
      await s3Client.send(command);
      imageUrl = `${process.env.S3_BUCKET_ACCESS_URL}match/${fileName}.${fileMimetype}`;
    }
    const currentDate = new Date();
    const match = await Match.create({
      ...updateBody,
      chatId: updateBody.chatId,
      players: [],
      activePlayers: [],
      teamA: [],
      teamB: [],
      pictureUrl: imageUrl,
      costPerPerson: 0,
      lockTimer: moment(`${updateBody.date} ${updateBody.kickOff}`, 'DD-MM-YYYY hh:mm A').diff(moment(), 'minutes'),
      isCancelled: false,
      isLocked: false,
      creationDate: currentDate,
    });
    // push every group member and admin in the player's array as an object with player id and status
    await User.find({ _id: { $in: chatGroup.admins } })
    .select('firstName lastName')
    .then(
      users => {
        users.forEach(user => {
          match.players.push({
            _id: user._id,
            name: user.firstName + ' ' + user.lastName,
            participationStatus: 'pending',
            payment: 'unpaid',
          });
        });
    });

    await User.find({ _id: { $in: chatGroup.membersList } })
    .select('firstName lastName')
    .then(
      users => {
        users.forEach(user => {
          match.players.push({
            _id: user._id,
            name: user.firstName + ' ' + user.lastName,
            participationStatus: 'pending',
            payment: 'unpaid',
          });
        });
    });
    match.save();
    res.status(201).send({ match, message: 'Match has been created.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getAllMatches = async (req, res) => {
  const { chatId } = req.params
  const userInfo = req.session.userInfo;
  try {
    const chatGroup = await Chat.findOne({ _id: chatId }, '-deleted -__v');
    if (!chatGroup)
      return res
        .status(404)
        .send({ error: 'Chat group was not found.' });
    const isAdmin = chatGroup.admins.includes(userInfo?.userId);
    const isMember = chatGroup.membersList.includes(userInfo?.userId);
    if (!isMember && !isAdmin)
      return res
        .status(404)
        .send({ error: 'You are not a part of this chat group.' });
    const groupMatches = await Match.find({ chatId }); // Find all matches for that chat group
    if (!groupMatches)
      return res
        .status(404)
        .send({ error: 'No matches found for the chat group.' });
    for (const match of groupMatches) { // Updates the lock timer for each match
      await match.updateLockTimer();
      await match.updateCostPerPerson();
    }
    res.status(200).send({ groupMatches });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getActivePlayers = async (req, res) => {
  const { matchId } = req.params;
  const userInfo = req.session.userInfo;
  try {
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const chat = await Chat.findOne({ _id: match.chatId }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
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
  const userInfo = req.session.userInfo;
  try {
  await updateMatchSchema.validate(updateBody);
  const chat = await Chat.findOne({ _id: updateBody.chatId }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const matchExists = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!matchExists)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  if (matchExists.isCancelled || matchExists.isLocked)
    return res
      .status(403)
      .send({ error: 'This match is closed. Please create new match.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update a match.' });
  let fileName = '';
  let imageUrl = matchExists.pictureUrl;
  if (req.file) {
    if (matchExists?._doc?.pictureUrl) {
      const commandDel = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: `${
          matchExists?.pictureUrl?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
        }`,
      });
      await s3Client.send(commandDel);
    }
    fileName = crypto.randomBytes(32).toString('hex');
    const fileMimetype = req.file?.mimetype.split('/')[1];
    const buffer = await sharp(req.file?.buffer)
      .resize({ width: 960, height: 540, fit: 'contain' })
      .toBuffer();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `match/${fileName}.${fileMimetype}`,
      Body: buffer,
      ContentType: req.file?.mimetype,
    });
    await s3Client.send(command);
    imageUrl = `${process.env.S3_BUCKET_ACCESS_URL}match/${fileName}.${fileMimetype}`;
  }
  const match = await Match.findByIdAndUpdate(
    matchId,
    {
      title: updateBody.title,
      location: updateBody.location,
      pictureUrl: imageUrl,
      type: updateBody.type,
      date: updateBody.date,
      meetTime: updateBody.meetTime,
      kickOff: updateBody.kickOff,
      duration: updateBody.duration,
      shift: updateBody.shift,
      pitchNumber: updateBody.pitchNumber,
      teamAColor: updateBody.teamAColor,
      teamBColor: updateBody.teamBColor,
      turf: updateBody.turf,
      boots: updateBody.boots,
      condition: updateBody.condition,
      lockTimer: moment(`${updateBody.date} ${updateBody.kickOff}`, 'DD-MM-YYYY hh:mm A').diff(moment(), 'minutes'),
      cost: updateBody.cost,
      recurring: updateBody.recurring,
    }, 
    { new: true }
  );
  const activePlayers = match.players.filter(
    (player) => player.participationStatus === 'in'
  );
  const numActivePlayers = activePlayers.length;
  const costPerPerson = numActivePlayers > 0 ? match.cost / numActivePlayers : 0;
  match.costPerPerson = costPerPerson;
  match.save();
  if (!match)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
  res.status(200).send({ match, message: 'Match has been updated.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const updateParticiationStatus = async (req,res) => {
  const { matchId } = req.params;
  const { status } = req.body;
  const userInfo = req.session.userInfo;
  try {
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  if (match.isCancelled || match.isLocked)
    return res
      .status(403)
      .send({ error: 'Match is closed. Please create new match.' });
  const user = await User.findOne({ _id: userInfo?.userId }, '-deleted -__v');
  if (!user)
    return res
      .status(404)
      .send({ error: 'User timeout. Please login and try again.' });
  const player = match.players.some( player => player._id === userInfo?.userId );
  if (!player)
    return res
      .status(404)
      .send({ error: 'You are not a part of this match.' });
  const isActivePlayer = match.activePlayers.find(player => player._id === userInfo?.userId);
  const isInTeamA = match.teamA.find(player => player._id === userInfo?.userId);
  const isInTeamB = match.teamB.find(player => player._id === userInfo?.userId);
  if (isInTeamA || isInTeamB)
    return res
      .status(403)
      .send({ error: 'You are already a part of a team.' });
  if (!match.isOpenForPlayers())
    return res
      .status(403)
      .send({ error: 'The match is no longer accepting new players.' });
  const update = { 'players.$[elem].participationStatus': status };
  const options = { arrayFilters: [{ 'elem._id': userInfo?.userId }], new: true };
  if (!isActivePlayer && status === 'in') {
    update['$push'] = { activePlayers: {
      _id: userInfo?.userId,
      name: user.firstName + ' ' + user.lastName,
      phone: user.phone,
      profileUrl: user.profileUrl,
    } };
  } else if (isActivePlayer && status === 'out') {
    const hasPaid = match.players.find((player) => player._id === userInfo?.userId)?.payment === 'paid';
    if (hasPaid) {
      return res
        .status(403)
        .send({ error: 'Unable to leave after payment completed.' });
    }
    else {
      update['$pull'] = { activePlayers: {_id: userInfo?.userId} };
    }
  }
  const updatedMatch = await Match.findByIdAndUpdate(matchId, update, options);
  await updatedMatch.updateCostPerPerson();
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
  const userInfo = req.session.userInfo;
  try {
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  if (match.isCancelled || match.isLocked)
    return res
      .status(403)
      .send({ error: 'Match is closed. Please create new match.' });
  const user = await User.findOne({ _id: userInfo?.userId }, '-deleted -__v');
  if (!user)
    return res
      .status(404)
      .send({ error: 'User timeout. Please login and try again.' });
  const player = match.players.find( player => player._id === memberId );
  if (!player)
    return res
      .status(404)
      .send({ error: 'Player is not a part of this match.' });
  const chat = await Chat.findOne({ _id: match.chatId._id }, '-deleted -__v');
  let isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update payment.' });
  if (!player.participationStatus === 'in')
    return res
      .status(403)
      .send({ error: 'Player is not active.' });
  const update = { 'players.$[elem].payment': payment };
  const options = { arrayFilters: [{ 'elem._id': memberId }], new: true };
  const updatedMatch = await Match.findByIdAndUpdate(matchId, update, options);
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
  const userInfo = req.session.userInfo;
  try {
  const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  if (match.isCancelled || match.isLocked)
    return res
      .status(403)
      .send({ error: 'Match is closed. Please create new match.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to add players.' });
  if (members.length === 0)
    return res
      .status(404)
      .send({ error: "Please provide at least one member to add to the team." });
  const activePlayers = match.activePlayers;
  const newTeamMembers = [];
  members.forEach(memberId => {
    let foundPlayer = activePlayers.find(player => player._id.toString() === memberId.toString());
    if (foundPlayer) {
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
  const userInfo = req.session.userInfo;
  try {
  const chat = await Chat.findOne({ _id: chatId }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  if (match.isCancelled || match.isLocked)
    return res
      .status(403)
      .send({ error: 'Match is closed. Please create new match.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to remove players.' });
  const activePlayers = ( team === 'A' ? match.teamA : match.teamB );
  const foundPlayer = activePlayers.find(player => player._id.toString() === memberId.toString());
  if (!foundPlayer)
    return res
      .status(404)
      .send({ error: `Unable to find player of team ${team}.` });
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
  const userInfo = req.session.userInfo;
  try {
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (match?._doc?.deleted?.isDeleted)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const chat = await Chat.findOne({ _id: match.chatId._id }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to cancel a match.' });
  if (match.isCancelled || match.isLocked)
    return res
      .status(403)
      .send({ error: 'Match is closed.' });
  const cancelMatch = await Match.findByIdAndUpdate(
    matchId,
    { isCancelled: true },
    { new: true }
    );
  if (!cancelMatch)
    return res
      .status(404)
      .send({ error: 'Something went wrong please try again later.' });
  res.status(201).send({ message: 'Match has been cancelled.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const deleteMatch = async (req, res) => {
  const { matchId } = req.params;
  const userInfo = req.session.userInfo;
  try {
  const match = await Match.findOne({ _id: matchId }, '-deleted -__v');
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const chat = await Chat.findOne({ _id: match.chatId._id }, '-deleted -__v');
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group for that match was not found.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to delete a match.' });
  const deleteMatch = await Match.findByIdAndDelete(matchId);
  if (!deleteMatch)
    return res
      .status(404)
      .send({ error: 'Something went wrong please try again later.' });
  if (match?._doc?.pictureUrl) {
    const commandDel = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: `${
        match?.pictureUrl?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
      }`,
    });
    await s3Client.send(commandDel);
    }
    res.status(201).send({ message: 'Match has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
