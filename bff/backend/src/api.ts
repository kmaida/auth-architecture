import express from 'express';

export function api(app: express.Application, secure: express.RequestHandler) {
  /*---------------------------------
        Protected Local API
  ---------------------------------*/

  /*----------- GET /api/protected-data ------------*/

  // Sample API endpoint that returns protected data (replace this with your actual API logic)
  // This endpoint is protected and requires the user to be authenticated
  app.get('/api/protected-data', secure, async (req, res) => {
    // Data that should be returned to authenticated users
    // Replace with your actual protected data
    const protectedData = {
      message: 'This is protected data that only authenticated users can access.'
    };
    res.status(200).json(protectedData);
  });
}
