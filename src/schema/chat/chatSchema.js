import { object, string, number } from 'yup';

export const chatMessageSchema = object({
    message: object(),
});

export const matchSchema = object({
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
    teamAColor: string(),
    teamBColor: string(),
    turf: string(),
    boots: string(),
    condition: string(),
    costPerPerson: number(),
    collected: number(),
    recurring: string(),
});

export const updateMatchSchema = object({
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
    teamAColor: string(),
    teamBColor: string(),
    turf: string(),
    boots: string(),
    condition: string(),
    costPerPerson: number(),
    collected: number(),
    recurring: string(),
});
