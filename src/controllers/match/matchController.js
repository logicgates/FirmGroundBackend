import { errorMessage } from '../../config/config.js';
import Match from '../../models/match/Match.js';
import { object, string } from 'yup';

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
  const { updateBody } = req.body;
  try {
    await matchSchema.validate(updateBody);
    let alreadyExist = await Match.findOne({title: updateBody.title});
    if (alreadyExist) return res.status(400).send({error:'Match with that title already exists.'});
    await Match.create({
        groupId: updateBody.groupId,
        players: [],
        teamA: [],
        teamB: [],
        title: updateBody.title,
        location: updateBody.location,
        pictureUrl: updateBody.pictureUrl,
        type: updateBody.type,
        date: updateBody.date,
        meetTime: updateBody.meetTime,
        kickOff: updateBody.kickOff,
        duration: updateBody.duration,
        shift: updateBody.shift,
        pitchNo: updateBody.pitchNo,
        teamAColor: updateBody.teamAColor,
        teamBColor: updateBody.teamBColor,
        turf: updateBody.turf,
        boots: updateBody.boots,
        condition: updateBody.condition,
        cost: updateBody.cost,
        recurring: updateBody.recurring,
        status: updateBody.status,
        amountCollected: updateBody.amountCollected,
        referee: updateBody.referee,
      });
      // push every group member and admin in the player's array as an object with player id and status
      res.status(201).send({message:'Match created.'});
  } catch (error) {
        errorMessage(res,error);
  }
}

export const getMatches = async (req,res) => {
  const { groupId } = req.body;
  try {
    const groupMatches = await Match.find({groupId}); // Find all matches for that group chat
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
    await Match.deleteOne({_id: matchId});
    res.status(201).send({message: 'Match has been removed.'});
  } catch (error) {
    errorMessage(res,error);
  }
}