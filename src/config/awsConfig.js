import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv'
dotenv.config();

const bucketRegion = process.env.S3_BUCKET_REGION;
const bucketAccessKey = process.env.S3_BUCKET_ACCESS_KEY;
const bucketSecretKey = process.env.S3_BUCKET_SECRET_ACCESS_KEY;

export const s3Client = new S3Client({
    credentials: {
        accessKeyId: bucketAccessKey,
        secretAccessKey: bucketSecretKey,
    },
    region: bucketRegion,
});