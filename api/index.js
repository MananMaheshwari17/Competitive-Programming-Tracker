
const { app, initDb } = require('../dist/server/app');

let dbReady;

module.exports = async function handler(req, res) {
  try {
    if (!dbReady) {
      dbReady = initDb().catch((error) => {
        dbReady = undefined;
        throw error;
      });
    }

    await dbReady;
    app(req, res);
  } catch (error) {
    console.error('Database initialization failed:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Database initialization failed.'
      });
    }
  }
};
