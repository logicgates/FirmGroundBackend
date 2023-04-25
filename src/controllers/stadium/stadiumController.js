import { errorMessage } from '../../config/config.js';
import Stadium from '../../models/stadium/stadium.js';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/awsConfig.js';
import sharp from 'sharp';
import crypto from 'crypto';

const bucketName = process.env.S3_BUCKET_NAME;

export const getStadiumLocations = async (req, res) => {
    try {
        const stadiums = await Stadium.find().sort('name');
        if (!stadiums)
            return res
                .status(404)
                .send({ error: 'No stadium location found.' });
        res.status(201).send({ stadiums });
    } catch (error) {
        errorMessage(res,error);
    }
}

export const addStadium = async (req, res) => {
    try {
        const alreadyExist = await Stadium.findOne({ name: req.body?.name }, '-deleted -__v');
        if (alreadyExist)
            return res
                .status(400)
                .send({ error: 'Stadium with that name already exists.' });
        let imageUrl = '';
        let fileName = '';
        if (req.file) {
            fileName = crypto.randomBytes(32).toString('hex');
            const fileMimetype = req.file?.mimetype.split('/')[1];
            const buffer = await sharp(req.file?.buffer)
                .resize({ width: 960, height: 540, fit: 'contain' })
                .toBuffer();
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: `stadium/${fileName}.${fileMimetype}`,
                Body: buffer,
                ContentType: req.file?.mimetype,
            });
            await s3Client.send(command);
            imageUrl = `${process.env.S3_BUCKET_ACCESS_URL}stadium/${fileName}.${fileMimetype}`;
        }
        const stadium = await Stadium.create({
            pictureUrl: imageUrl,
            ...req.body,
        });
        if (!stadium)
            return res
                .status()
                .send({ error: 'Something went wrong. Please try again later.'});
        res.status(201).send({ stadium, message: 'Stadium details have been added.' });
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
        let imageUrl = stadium.pictureUrl;
        let fileName = '';
        if (req.file) {
            if (stadium?._doc?.pictureUrl) {
                const commandDel = new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: `${
                        stadium?.pictureUrl?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
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
                    Key: `stadium/${fileName}.${fileMimetype}`,
                    Body: buffer,
                    ContentType: req.file?.mimetype,
                });
                await s3Client.send(command);
                imageUrl = `${process.env.S3_BUCKET_ACCESS_URL}stadium/${fileName}.${fileMimetype}`;
            }
        const updatestadium = await Stadium.findByIdAndUpdate(
            stadiumId,
            {
                name: req.body?.name,
                location: req.body?.location,
                pictureUrl: imageUrl,
                pitches: req.body?.pitches,
                cost: req.body?.cost,
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
        if (stadium?._doc?.pictureUrl) {
        const commandDel = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: `${
                stadium?.pictureUrl?.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
            }`,
        });
        await s3Client.send(commandDel);
        }
        res.status(201).send({ message: 'Stadium details have been removed.' });
    } catch (error) {
        errorMessage(res, error);
    }
};