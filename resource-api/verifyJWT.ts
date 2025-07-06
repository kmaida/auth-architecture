require('dotenv/config');
import { createRemoteJWKSet, jwtVerify, errors } from 'jose';
import { Request, Response, NextFunction } from 'express';

const fusionAuthURL = process.env.FUSION_AUTH_URL || 'http://localhost:9011';
const bffTmbClientId = process.env.CLIENT_ID_BFF_TMB;
const bbocClientId = process.env.CLIENT_ID_BBOC;

// Validate required environment variables
if (!bffTmbClientId) {
  throw new Error('CLIENT_ID_BFF_TMB environment variable is required');
}
if (!bbocClientId) {
  throw new Error('CLIENT_ID_BBOC environment variable is required');
}

// Create a JWK Set client to fetch the JWKS from FusionAuth
const jwksClient = createRemoteJWKSet(
  new URL(`${fusionAuthURL}/.well-known/jwks.json`)
);

// Type stuff
interface VerifiedTokenRequest extends Request {
  verifiedToken?: string;
}

const verifyJWT = async (
  req: VerifiedTokenRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader: string | undefined = req.headers.authorization;
  const accessToken: string | null = authHeader ? authHeader.split(' ')[1] : null;
  
  if (!accessToken) {
    res.status(401);
    res.send({ error: 'Missing Authorization header' });
  } else {
    try {
      await jwtVerify(accessToken, jwksClient, {
        issuer: fusionAuthURL,
        audience: [bffTmbClientId, bbocClientId],
      });
      req.verifiedToken = accessToken;
      next();
    } catch (e: unknown) {
      if (e instanceof errors.JOSEError) {
        res.status(401);
        res.send({ error: e.message, code: e.code });
      } else {
        console.dir(`Internal server error: ${e}`);
        res.status(500);
        res.send({ error: JSON.stringify(e) });
      }
    }
  }
};

export default verifyJWT;