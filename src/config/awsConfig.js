import { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand, DeleteObjectCommand, ListObjectsCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import sharp from 'sharp';
import dotenv from 'dotenv'
dotenv.config();

const bucketName = process.env.S3_BUCKET_NAME;
const bucketRegion = process.env.S3_BUCKET_REGION;
const bucketAccessKey = process.env.S3_BUCKET_ACCESS_KEY;
const bucketSecretKey = process.env.S3_BUCKET_SECRET_ACCESS_KEY;

export const s3Client = new S3Client({
    accessKeyId: bucketAccessKey,
    secretAccessKey: bucketSecretKey,
    region: bucketRegion,
});

export async function deleteFromBucket (objKey) {
  const commandDel = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: `${
        objKey.split(`${process.env.S3_BUCKET_ACCESS_URL}`)[1]
      }`,
    });
    await s3Client.send(commandDel);
};

export async function addToBucket (image, collection) {
  const fileName = crypto.randomBytes(32).toString('hex');
  const fileMimetype = image.mimetype.split('/')[1];
  const buffer = await sharp(image.buffer)
    .resize({ width: 520, height: 520, fit: 'contain' })
    .toBuffer();
  const commandPut = new PutObjectCommand({
    Bucket: bucketName,
    Key: `${collection}/${fileName}.${fileMimetype}`,
    Body: buffer,
    ContentType: image.mimetype,
  });
  await s3Client.send(commandPut);
  return `${process.env.S3_BUCKET_ACCESS_URL}${collection}/${fileName}.${fileMimetype}`;
};

export default {
    addToBucket,
    deleteFromBucket
}