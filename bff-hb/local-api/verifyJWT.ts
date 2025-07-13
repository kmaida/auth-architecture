import 'dotenv/config';
import { createRemoteJWKSet, jwtVerify, errors } from 'jose';
import { Request, Response, NextFunction } from 'express';

const fusionAuthURL = process.env.AUTHZ_SERVER_URL || 'http://localhost:9011';
const clientId = process.env.CLIENT_ID;

// Validate required environment variables
if (!clientId) {
  throw new Error('CLIENT_ID environment variable is required');
}

/** Fetch JWKS from FusionAuth */
const jwksClient = createRemoteJWKSet(
  new URL(`${fusionAuthURL}/.well-known/jwks.json`)
);

// Type stuff
interface VerifiedTokenRequest extends Request {
  verifiedToken?: string;
}

/** Middleware to verify JWT 
  * @param req Express request object
  * @param res Express response object
  * @param next Next middleware function
  * @returns void
  */
const verifyJWT = async (
  req: VerifiedTokenRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const accessToken = req.cookies['app.at'];
  
  if (!accessToken) {
    res.status(401).send({ error: 'Missing access token' });
    return;
  }

  try {
    await jwtVerify(accessToken, jwksClient, {
      issuer: fusionAuthURL,
      audience: clientId,
    });
    req.verifiedToken = accessToken;
    next();
  } catch (e: unknown) {
    if (e instanceof errors.JOSEError) {
      res.status(401).send({ error: e.message, code: e.code });
    } else {
      console.error(`Internal server error: ${e}`);
      res.status(500).send({ error: 'Internal server error' });
    }
  }
};

export default verifyJWT;