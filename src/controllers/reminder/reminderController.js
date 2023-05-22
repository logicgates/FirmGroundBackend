import { errorMessage } from '../../config/config.js';
import User from '../../models/user/User.js';
import Match from '../../models/match/Match.js';
import db from '../../config/firebaseConfig.js';

export const addReminder = async (req, res) => {
    const { matchId } = req.params;
    const { timeAndDate } = req.body;
    const userId = req.session.userInfo?.userId;
    if (!userId)
        return res
            .status(401)
            .send({ error: 'User timeout. Please login again.' });
    try {
        const match = await Match.findOne({ _id: matchId }, '-__v');
        if (!match)
            return res
                .status(404)
                .send({ error: 'Match for chat group was not found.' });
        if (match.isLocked || match.isCancelled)
            return res
                .status(404)
                .send({ error: 'Match is unavailable.' });
        const timestamp = Date.now();
        const reminder = {
            matchId,
            userId,
            timeAndDate,
            matchStatus,
            timestamp,
        };
        firebase.database().ref('reminders').push(reminder)
            .then(() => {
                res.status(201).send({ message: 'Reminder added successfully' });
            })
            .catch((error) => {
                res.status(500).send({ error: 'Failed to add reminder' });
            });
    } catch (error) {
        errorMessage(res, error);
    }
};

export const viewReminder = (req, res) => {
    const { reminderId } = req.params;
    const userId = req.session.userInfo?.userId;
    if (!userId)
        return res
            .status(401)
            .send({ error: 'User timeout. Please login again.' });
    try {
        firebase.database().ref(`reminders/${reminderId}`)
            .once('value')
            .then((snapshot) => {
        const reminder = snapshot.val();
        if (reminder) {
            res.status(200).send({ reminder });
        } else {
            res.status(404).send({ error: 'Reminder not found' });
        }
        })
        .catch((error) => {
            res.status(500).send({ error: 'Failed to retrieve reminder' });
        });
    } catch (error) {
        errorMessage(res, error);
    }
};

export const viewAllReminders = (req, res) => {
    const { matchId } = req.params;
    const userId = req.session.userInfo?.userId;
    if (!userId)
        return res
            .status(401)
            .send({ error: 'User timeout. Please login again.' });
    try {
        firebase.database().ref('reminders')
            .orderByChild('matchId_userId')
            .equalTo(`${matchId}_${userId}`)
            .once('value')
            .then((snapshot) => {
            const reminders = snapshot.val();
            if (reminders) {
                const remindersList = Object.values(reminders);
                res.status(200).json({ reminders: remindersList });
            } else {
                res.status(404).json({ error: 'Reminders not found' });
            }
            })
            .catch((error) => {
            res.status(500).json({ error: 'Failed to retrieve reminders', details: error });
            });
    } catch (error) {
        errorMessage(res, error);
    }
}

export const editReminder = (req, res) => {
    const { reminderId } = req.params;
    const { data } = req.body;
    const userId = req.session.userInfo?.userId;
    if (!userId)
        return res
            .status(401)
            .send({ error: 'User timeout. Please login again.' });
    try {
        firebase.database().ref(`reminders/${reminderId}`)
            .update(data)
                .then(() => {
                    res.status(200).send({ message: 'Reminder updated successfully' });
                })
                .catch((error) => {
                    res.status(500).send({ error: 'Failed to update reminder' });
                });
    } catch (error) {
        errorMessage(res, error);
    }
};

export const deleteReminder = (req, res) => {
    const { reminderId } = req.params;
    try {
        firebase.database().ref(`reminders/${reminderId}`)
            .remove()
                .then(() => {
                res.status(200).send({ message: 'Reminder deleted successfully' });
                })
                .catch((error) => {
                res.status(500).send({ error: 'Failed to delete reminder' });
                });
    } catch (error) {
        errorMessage(res, error);
    }
};
