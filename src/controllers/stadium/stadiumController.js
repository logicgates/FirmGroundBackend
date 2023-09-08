import { errorMessage } from '../../config/config.js';
import Stadium from '../../models/stadium/Stadium.js';
import { deleteFromBucket, addToBucket } from '../../config/awsConfig.js';

export const getAllStadiums = async (req, res) => {
    try {
        const stadiums = await Stadium.find().sort('name');
        if (!stadiums)
            return res
                .status(404)
                .send({ error: 'No stadium details found.' });
        res.status(201).send({ stadiums });
    } catch (error) {
        errorMessage(res,error);
    }
};

export const addStadium = async (req, res) => {
    try {
        const stadium = await Stadium.findOne({ name: req.body?.name }, '-deleted -__v');
        if (stadium)
            return res
                .status(400)
                .send({ error: 'Stadium with that name already exists.' });
        const fileName = req.file ? await addToBucket(req.file, 'stadium') : stadium?.pictureUrl;
        const newStadium = await Stadium.create({
            name: req.body?.name,
            location: req.body?.location,
            pictureUrl: fileName,
            pitches: JSON.parse(req.body?.pitches),
        });
        if (!newStadium)
            return res
                .status()
                .send({ error: 'Something went wrong. Please try again later.'});
        res.status(201).send({ stadium: newStadium, message: 'Stadium details have been added.' });
    } catch (error) {
        errorMessage(res,error);
    }
};

export const updateStadium = async (req, res) => {
    const { stadiumId } = req.params;
    try {
        const stadium = await Stadium.findOne({ _id: stadiumId }, '-deleted -__v');
        if (!stadium)
            return res
                .status(400)
                .send({ error: 'Stadium details do not exist.' });
        const fileName = req.file ? await addToBucket(req.file, 'stadium') : stadium?.pictureUrl;
        if (stadium?.pictureUrl !== fileName)
            await deleteFromBucket(stadium?.pictureUrl);
        const updatestadium = await Stadium.findByIdAndUpdate(
            stadiumId,
            {
                name: req.body?.name,
                location: req.body?.location,
                pictureUrl: fileName,
                pitches: JSON.parse(req.body?.pitches),
            },
            { new: true }
        );
        if (!updatestadium)
            return res
                .status()
                .send({ error: 'Something went wrong. Please try again later.'});
        res.status(201).send({ stadium: updatestadium, message: 'Stadium details have been updated.' });
    } catch (error) {
        errorMessage(res,error);
    }
};

export const updatePitchDetails = async (req, res) => {
    const { stadiumId } = req.params;
    try {
        const stadium = await Stadium.findOne({ _id: stadiumId }, '-deleted -__v');
        if (!stadium)
            return res
                .status(400)
                .send({ error: 'Stadium details do not exist.' });
        const update = {
            'pitches.$[elem].turf': req.body?.turf,
            'pitches.$[elem].boots': req.body?.boots,
            'pitches.$[elem].condition': req.body?.condition
        };
        const options = { arrayFilters: [{ 'elem._id': req.body?.pitchNo }], new: true };
        const updatedPitch = await Stadium.findByIdAndUpdate(stadiumId, update, options);
        if (!updatedPitch)
            return res
                .status()
                .send({ error: 'Something went wrong. Please try again later.'});
        res.status(201).send({ stadium: updatedPitch, message: 'Pitch details have been updated.' });
    } catch (error) {
        errorMessage(res,error);
    }
};

export const deleteStadium = async (req, res) => {
    const { stadiumId } = req.params;
    try {
        const stadium = await Stadium.findOne({ _id: stadiumId }, '-deleted -__v');
        if (!stadium)
            return res
                .status(400)
                .send({ error: 'Stadium location does not exist.' });
        const deleteStadium = await Stadium.findByIdAndDelete(stadiumId);
        if (!deleteStadium)
            return res
                .status(404)
                .send({ error: 'Something went wrong please try again later.' });
        if (stadium?._doc?.pictureUrl)
            await deleteFromBucket(stadium?.pictureUrl);
        res.status(201).send({ message: 'Stadium details have been removed.' });
    } catch (error) {
        errorMessage(res, error);
    }
};