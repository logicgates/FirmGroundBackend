import { errorMessage } from '../../config/config.js';
import Group from '../../models/group/group.js';

export const createGroup = async (req,res) => {
    const { members } = req.body;
  try {
    const membersArray = members.split(',');
    let today = new Date();
    let newGroup = await Group.create({
      title: req.body.title,
      admins: req.params.userId,
      membersList: [],
      creationDate: today
    });
    membersArray.forEach((member) => { newGroup.membersList.push(member); });
    newGroup.save();
    res.status(201).send({group: newGroup, message:'Group created.'});
  } catch (error) {
        errorMessage(res,error);
  }
}

export const getGroups = async (req,res) => {
  const { userId } = req.params;
  try {
    const groups = await Group.find({ // Find all groups if user is admin or member only
        $or: [ 
          { admins: userId }, 
          { membersList: userId }
        ],
    });
    if (!groups) return res.status(404).send({ error: 'No groups found.' });
    res.status(200).send({ groups });
  } catch (error) {
    errorMessage(res,error);
  }
}

export const deleteGroup = async (req,res) => {
  const { groupId } = req.params;
  try {
    const user = await Group.findById(groupId);
    if(!user) return res.status(404).send({error: 'Group does not exist.'});
    await Group.deleteOne({_id: groupId});
    res.status(201).send({message: 'Group has been deleted.'});
  } catch (error) {
    errorMessage(res,error);
  }
}