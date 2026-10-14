
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app, { initDb } from '../server/app';

let dbReady: Promise<void> | null = null;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (!dbReady) {
      dbReady = initDb().catch((error) => {
        dbReady = null;
        throw error;
      });
    }

    await dbReady;
    app(req, res);
  } catch (error) {
    console.error('Database initialization failed:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Database initialization failed.' });
    }
  }
}
