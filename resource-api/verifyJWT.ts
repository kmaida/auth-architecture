import 'dotenv/config';
import { createRemoteJWKSet, jwtVerify, errors } from 'jose';
import { Request, Response, NextFunction } from 'express';

const fusionAuthURL = process.env.AUTHZ_SERVER_URL || 'http://localhost:9011';
const bffTmbClientId = process.env.CLIENT_ID_BFF_TMB;
const bbocClientId = process.env.CLIENT_ID_BBOC;

// Validate required environment variables
if (!bffTmbClientId) {
  throw new Error('CLIENT_ID_BFF_TMB environment variable is required');
}
if (!bbocClientId) {
  throw new Error('CLIENT_ID_BBOC environment variable is required');
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
  const authHeader: string | undefined = req.headers.authorization;
  const accessToken: string | null = authHeader ? authHeader.split(' ')[1] : null;
  
  if (!accessToken) {
    res.status(401).send({ error: 'Missing Authorization header' });
    return;
  }

  try {
    await jwtVerify(accessToken, jwksClient, {
      issuer: fusionAuthURL,
      audience: [bffTmbClientId, bbocClientId],
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