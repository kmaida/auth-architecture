import express from 'express';

export function resourceApi(app: express.Application, secure: express.RequestHandler) {
  /*---------------------------------
         External API proxy
  ---------------------------------*/

  /*----------- GET /resource/api/recipe ------------*/

  // Sample API proxy endpoint that fetches data from an external API and returns it to the client
  // This endpoint is protected and requires the user to be authenticated
  app.get('/resource/api/recipe', secure, async (req, res) => {
    try {
      // Get access token from request (attached by secure middleware)
      const accessToken = (req as any).accessToken;
      
      if (!accessToken) {
        return res.status(401).json({
          error: 'No access token available'
        });
      }

      // Make call to external API with authorization header
      const response = await fetch(`${process.env.RESOURCE_API_URL}/api/recipe`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('External API error:', response.status, errorText);
        return res.status(response.status).json({
          error: 'Failed to fetch data from external API',
          details: errorText
        });
      }

      const externalData = await response.json();
      res.status(200).json(externalData);
    } catch (error) {
      console.error('Error calling external API:', error);
      res.status(500).json({
        error: 'Internal server error while calling external API'
      });
    }
  });
}
