import { errorMessage } from '../../config/config.js';
import Match from '../../models/match/Match.js';
import { object, string, number } from 'yup';
import Chat from '../../models/chat/ChatModel.js';

const matchSchema = object({
  title: string().required('Title required.'),
  location: string().required('Location is required.'),
  pictureUrl: string().url().nullable(),
  type: string().required('Type of match is required.'),
  date: string().required('Date of match is required.'),
  meetTime: string().required('Time to meet is required.'),
  kickOff: string().required('Time for kick-off is required.'),
  duration: string().required('Duration of match is required.'),
  shift: string().required('Required time of day, morning/evening/night.'),
  pitchNumber: string().required('Required pitch number.'),
  teamAColor: string().required('Color of team A required.'),
  teamBColor: string().required('Color of team B required.'),
  turf: string(),
  boots: string(),
  condition: string(),
  cost: number().positive().integer(),
  costPerPerson: number().positive().integer(),
  recurring: string(),
});

const updateMatchSchema = object({
  title: string().required('Title required.'),
  location: string().required('Location is required.'),
  pictureUrl: string().url().nullable(),
  type: string().required('Type of match is required.'),
  date: string().required('Date of match is required.'),
  meetTime: string().required('Time to meet is required.'),
  kickOff: string().required('Time for kick-off is required.'),
  duration: string().required('Duration of match is required.'),
  shift: string().required('Required time of day, morning/evening/night.'),
  pitchNumber: string().required('Required pitch number.'),
  teamAColor: string().required('Color of team A required.'),
  teamBColor: string().required('Color of team B required.'),
  turf: string(),
  boots: string(),
  condition: string(),
  cost: number().positive().integer(),
  costPerPerson: number().positive().integer(),
  recurring: string(),
});

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
    let currentDate = new Date();
    const match = await Match.create({
      chatId: updateBody.chatId,
      players: [],
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
    let isAdmin = chatGroup.admins.includes(userInfo?.userId);
    let isMember = chatGroup.membersList.includes(userInfo?.userId);
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

export const updateMatch = async (req, res) => {
  const { matchId } = req.params;
  const updateBody = req.body;
  const userInfo = req.session.userInfo;
  try {
  await updateMatchSchema.validate(updateBody);
  const chatGroup = await Chat.findById(updateBody.chatId);
  if (!chatGroup)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  let checkMatchExists = await Match.findById(matchId);
  if (!checkMatchExists)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  let isAdmin = chatGroup.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update a match.' });
  const match = await Match.findByIdAndUpdate(
    matchId,
    {
      title: updateBody.title,
      location: updateBody.location,
      pictureUrl: updateBody.pictureUrl,
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
    }, { new: true }
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
  let checkMatchExists = await Match.findById(matchId);
  if (!checkMatchExists)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  } catch (error) {
    errorMessage(res, error);
  }
}

export const deleteMatch = async (req, res) => {
  const { matchId } = req.params;
  const updateBody = req.body;
  const userInfo = req.session.userInfo;
  try {
  const chatGroup = await Chat.findById(updateBody.chatId);
  if (!chatGroup)
    return res
      .status(404)
      .send({ error: 'Chat group was not found.' });
  let checkMatchExists = await Match.findById(matchId);
  if (checkMatchExists?._doc?.deleted?.isDeleted)
    return res
      .status(404)
      .send({ error: 'Match for chat group was not found.' });
  let isAdmin = chatGroup.admins.includes(userInfo?.userId);
  if (!isAdmin)
    return res
      .status(404)
      .send({ error: 'Only admins are allowed to update a match.' });
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
