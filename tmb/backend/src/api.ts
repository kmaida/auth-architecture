import express from 'express';

export function api(app: express.Application, secure: express.RequestHandler) {
  /*---------------------------------
          Protected API
  ---------------------------------*/

  /*----------- GET /api/protected-data ------------*/

  // Sample API endpoint that returns protected data (replace this with your actual API logic)
  // This endpoint is protected and requires the user to be authenticated
  // It uses the `secure` middleware to ensure that only authenticated users can access it and requires a session cookie
  // This is a typical implementation for a protected API that runs on the same server as the backend (BFF)
  // Session cookies would not be used with an API that runs on a different server (e.g., a microservice architecture)
  app.get('/api/protected-data', secure, async (req, res) => {
    // Data that should be returned to authenticated users
    // Replace with your actual protected data
    const protectedData = {
      message: 'This is protected data that only authenticated users can access.'
    };
    res.status(200).json(protectedData);
  });
}
