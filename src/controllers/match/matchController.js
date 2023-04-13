import { errorMessage } from '../../config/config.js';
import Match from '../../models/match/Match.js';
import Chat from '../../models/chat/ChatModel.js';
import { matchSchema, updateMatchSchema, addPlayerToTeamSchema } from '../../schema/chat/chatSchema.js'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/awsConfig.js';
import sharp from 'sharp';
import crypto from 'crypto';

const bucketName = process.env.S3_BUCKET_NAME;

export const createMatch = async (req, res) => {
  const userInfo = req.session.userInfo;
  const updateBody = req.body;
  try {
    await matchSchema.validate(req.body);
    const chatGroup = await Chat.findById(updateBody.chatId);
    if (!chatGroup)
      return res
        .status(404)
        .send({ error: 'Chat group was not found.' });
    let isAdmin = chatGroup.admins.includes(userInfo?.userId);
    if (!isAdmin)
      return res
        .status(404)
        .send({ error: 'Only admins are allowed to create a match.' });
    let alreadyExist = await Match.findOne({ title: updateBody.title });
    if (alreadyExist)
      return res
        .status(400)
        .send({ error: 'Match with that title already exists.' });
    const currentDate = new Date();
    const match = await Match.create({
      chatId: updateBody.chatId,
      players: [],
      activePlayers: [],
      teamA: [],
      teamB: [],
      ...updateBody,
      creationDate: currentDate,
    });
    // push every group member and admin in the player's array as an object with player id and status
    chatGroup.admins.forEach((member) => {
      match.players.push({
        _id: member,
        participationStatus: 'pending',
      });
    });
    chatGroup.membersList.forEach((member) => {
      match.players.push({
        _id: member,
        participationStatus: 'pending',
      });
    });
    match.save();
    res.status(201).send({ match, message: 'Match has been created.' });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getAllMatches = async (req, res) => {
  const { chatId } = req.body
  const userInfo = req.session.userInfo;
  try {
    const chatGroup = await Chat.findById(chatId);
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
      return res.status(404).send({ error: 'No matches found for the chat group.' });
    res.status(200).send({ groupMatches });
  } catch (error) {
    errorMessage(res, error);
  }
};

export const getActivePlayers = async (req, res) => {
  const { matchId } = req.params;
  const { chatId } = req.body;
  const userInfo = req.session.userInfo;
  try {
  const chat = await Chat.findById(chatId);
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const match = await Match.findById(matchId);
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
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
  const chat = await Chat.findById(updateBody.chatId);
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const checkMatchExists = await Match.findById(matchId);
  if (!checkMatchExists)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update a match.' });
  let fileName = '';
  let imageUrl = chat.pictureUrl;
  if (req.file) {
    if (chat?._doc?.pictureUrl) {
      const commandDel = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: `${
          chat?.pictureUrl?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
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
      cost: updateBody.cost,
      costPerPerson: updateBody.costPerPerson,
      recurring: updateBody.recurring,
    }, 
    { new: true }
);
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
  const updateBody = req.body;
  const userInfo = req.session.userInfo;
  try {
  const match = await Match.findById(matchId);
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const player = match.players.some( (player) => player._id === userInfo?.userId );
  if (!player)
    return res
      .status(404)
      .send({ error: 'You are not a part of this match.' });
  const isActivePlayer = match.activePlayers.includes(userInfo?.userId);
  let updatedMatch;
  if (match.isOpenForPlayers()) {
    if(!isActivePlayer && updateBody.status === 'in') {
      updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        { 
          $set: { 'players.$[elem].participationStatus': updateBody.status },
          $push: { activePlayers: userInfo?.userId }
        },
        { arrayFilters: [{ 'elem._id': userInfo?.userId }], new: true },
      );
    }
    else if(isActivePlayer && updateBody.status === 'out') {
      updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        { 
          $set: { 'players.$[elem].participationStatus': updateBody.status },
          $pull: { activePlayers: userInfo?.userId }
        },
        { arrayFilters: [{ 'elem._id': userInfo?.userId }], new: true },
      );
    }
    else {
      updatedMatch = await Match.findByIdAndUpdate(
        matchId,
        { $set: { 'players.$[elem].participationStatus': updateBody.status }},
        { arrayFilters: [{ 'elem._id': userInfo?.userId }], new: true },
      );
    }
    if (!updatedMatch)
        return res
          .status(404)
          .send({ error: 'Something went wrong please try again later.' });
    res.status(200).send({ match: updatedMatch, message: 'Player participation status has been updated.' });
  }
  else{
    res.status(403).send({ error: 'The match is no longer accepting new players.' });
  }
  } catch (error) {
    errorMessage(res, error);
  }
};

export const addPlayerToTeam = async (req, res) => {
  const { matchId } = req.params;
  const { chatId, team, members } = req.body;
  const userInfo = req.session.userInfo;
  try {
  await addPlayerToTeamSchema.validate(team);
  const chat = await Chat.findById(chatId);
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  const match = await Match.findById(matchId);
  if (!match)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  const isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to add players.' });
  const updatedMatch = await Match.findByIdAndUpdate(
    matchId,
    { 
      $push: { [`team${team}`]: { $each: members } },
      $pull: { activePlayers: { $each: members } }
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

export const deleteMatch = async (req, res) => {
  const { matchId } = req.params;
  const updateBody = req.body;
  const userInfo = req.session.userInfo;
  try {
  const chat = await Chat.findById(updateBody.chatId);
  if (!chat)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  let checkMatchExists = await Match.findById(matchId);
  if (checkMatchExists?._doc?.deleted?.isDeleted)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  let isAdmin = chat.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update a match.' });
    const deleteMatch = await Match.findByIdAndDelete(matchId);
    if (!deleteMatch)
      return res
        .status(404)
        .send({ error: 'Something went wrong please try again later.' });
    if (chat?._doc?.pictureUrl) {
      const commandDel = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: `${
          chat?.pictureUrl?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
        }`,
      });
      await s3Client.send(commandDel);
    }
    res.status(201).send({ message: 'Match has been deleted.' });
  } catch (error) {
    errorMessage(res, error);
  }
};
