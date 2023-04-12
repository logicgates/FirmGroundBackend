const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();

export default db;