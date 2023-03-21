import express from 'express';
import https from 'https';
import fs from 'fs';
import path, { dirname } from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import routes from './src/routes/index.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

//Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

//Routes
app.get('/', (req, res) => res.send('<h1>Server Running</h1>'));
app.use('/api/v1', routes);

const PORT = process.env.PORT || 5200;

//Database Configuration and Application Start
mongoose.set('strictQuery', false);

//HTTPS Server
if (process.env.SERVER === 'development') {
  const sslServer = https.createServer(
    {
      cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
      key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
    },
    app
  );

  sslServer.listen(PORT, () =>
    mongoose
      .connect(process.env.MONGOOSE_URI)
      .then(() =>
        console.log(`Server is up and running on https://localhost:${PORT}/`)
      )
      .catch((error) => console.error({ error }))
  );
} else {
  app.listen(PORT, () =>
    mongoose
      .connect(process.env.MONGOOSE_URI)
      .then(() =>
        console.log(`Server is up and running on http://localhost:${PORT}/`)
      )
      .catch((error) => console.error({ error }))
  );
}
