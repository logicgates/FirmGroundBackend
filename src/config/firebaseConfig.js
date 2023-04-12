import admin from 'firebase-admin';
import serviceAccount from './serviceAccount.json' assert { type: "json" };
import dotenv from 'dotenv';
dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();

export default db;