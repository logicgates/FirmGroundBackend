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

export const create = async (req,res) => {
  try {
    await matchSchema.validate(req.body);
    let alreadyExist = await Match.findOne({email: req.body.email});
    if (alreadyExist) return res.status(400).send({error:'Match already exists.'});
    await Match.create({
        userList: req.body.userList,
        teamAId: req.body.teamAId,
        teamBId: req.body.teamBId,
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
