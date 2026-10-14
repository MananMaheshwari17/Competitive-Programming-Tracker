
import 'dotenv/config';
import express from 'express';
import path from 'path';
import app, { initDb } from './app';

const port = Number(process.env.PORT ?? 3001);
const localApp = express();

localApp.use(app);

const clientDir = path.join(__dirname, '../client');
localApp.use(express.static(clientDir));
localApp.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

initDb()
  .then(() => {
    localApp.listen(port, () => {
      console.log(`CP Tracker listening on :${port}`);
    });
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
