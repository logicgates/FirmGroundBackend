import { errorMessage } from '../../config/config.js';
import Match from '../../models/match/Match.js';
import { object, string } from 'yup';

let matchSchema = object({
    userList: string(),
    teamAId: string(),
    teamBId: string(),
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
  try {
    await matchSchema.validate(req.body);
    let alreadyExist = await Match.findOne({email: req.body.email});
    if (alreadyExist) return res.status(400).send({error:'Match already exists.'});
    await Match.create({
        groupId: req.body.groupId,
        joingList: [],
        notJoingList: [],
        teamA: [],
        teamB: [],
        title: req.body.title,
        location: req.body.location,
        pictureUrl: req.body.pictureUrl,
        type: req.body.type,
        date: req.body.date,
        meetTime: req.body.meetTime,
        kickOff: req.body.kickOff,
        duration: req.body.duration,
        shift: req.body.shift,
        pitchNo: req.body.pitchNo,
        teamAColor: req.body.teamAColor,
        teamBColor: req.body.teamBColor,
        turf: req.body.turf,
        boots: req.body.boots,
        condition: req.body.condition,
        cost: req.body.cost,
        recurring: req.body.recurring,
        status: req.body.status,
        amountCollected: req.body.amountCollected,
        referee: req.body.referee,
      });
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