import { errorMessage } from '../../config/config.js';
import Match from '../../models/match/Match.js';
import { object, string } from 'yup';
import Chat from '../../models/chat/Chat.js';

const matchSchema = object({
    title: string().required('Title required.'),
    location: string().required('Location is required.'),
    pictureUrl: string(),
    type: string().required('Type of match is required.'),
    date: string().required('Date of match is required.'),
    meetTime: string().required('Time to meet is required.'),
    kickOff: string().required('Time for kick-off is required.'),
    duration: string().required('Duration of match is required.'),
    shift: string().required('Required time of day, morning/evening/night.'),
    pitchNo: string().required('Required pitch number.'),
    teamAColor: string().required('Color of team A required.'),
    teamBColor: string().required('Color of team B required.'),
    turf: string(),
    boots: string(),
    condition: string(),
    cost: string().required('Cost of match required.'),
    recurring: string(),
    status: string(),
    amountCollected: string(),
    referee: string(),
});

export const createMatch = async (req,res) => {
  const { chatId } = req.params;
  const { updateBody } = req.body;
  const userInfo = req.userInfo;
  try {
    await matchSchema.validate(updateBody);
    const chatGroup = await Chat.findById(chatId);
    if (!chatGroup)
      return res
        .status(404)
        .send({error:'No chat group found with that id.'});
    //let isAdmin = await 
    let alreadyExist = await Match.findOne({title: updateBody.title});
    if (alreadyExist)
      return res
        .status(400)
        .send({error:'Match with that title already exists.'});
    let currentDate = new Date();
    const match = await Match.create({
        ...updateBody,
        groupId: chatId,
        players: [],
        teamA: [],
        teamB: [],
        creationDate: currentDate
      });
      // push every group member and admin in the player's array as an object with player id and status
      chatGroup.admins.forEach((member) => { match.players.push({playerId: member._id, participationStatus: 'pending'}); });
      chatGroup.membersList.forEach((member) => { match.players.push({playerId: member._id, participationStatus: 'pending'}); });
      match.save();
      res.status(201).send({match, message:'Match created.'});
  } catch (error) {
        errorMessage(res,error);
  }
}

export const getMatches = async (req,res) => {
  const { chatId } = req.body;
  try {
    const groupMatches = await Match.find({chatId}); // Find all matches for that chat group
    if (!groupMatches) return res.status(404).send({ error: 'No matches found.' });
    res.status(200).send({ groupMatches });
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteMatch = async (req,res) => {
  const { matchId } = req.body;
  try {
    const match = await Match.findById(matchId);
    if(!match) return res.status(404).send({error: 'Match does not exist.'});
    const chatGroup = await Chat.findOne(match.groupId);
    await Match.deleteOne({_id: matchId});
    res.status(201).send({message: 'Match has been removed.'});
  } catch (error) {
    errorMessage(res,error);
  }
}