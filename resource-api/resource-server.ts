import express from 'express';
import cors from 'cors';
import { promisify } from 'util';
import { lookup } from 'dns';
import verifyJWT from './verifyJWT';
import { resourceApi } from './resource-api';

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Import environment variables
import * as dotenv from "dotenv";
dotenv.config();

// Function to check if resource-api.local is available
const dnsLookup = promisify(lookup);

async function getServerURL(): Promise<string> {
  const port = process.env.PORT || 5001;
  const preferredHost = 'resource-api.local';
  const fallbackHost = 'localhost';
  
  try {
    await dnsLookup(preferredHost);
    console.log(`✓ ${preferredHost} is available`);
    return `http://${preferredHost}:${port}`;
  } catch (error) {
    console.log(`✗ ${preferredHost} not found in hosts file, falling back to ${fallbackHost}`);
    return `http://${fallbackHost}:${port}`;
  }
}

// Set up app
const app = express();
const port = process.env.PORT || 5001;

// Decode form URL encoded data
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies
app.use(express.json());

/*----------- DEV: Request logging middleware (remove in prod) ------------*/

app.use((req, res, next) => {
  // Skip logging for favicon and other browser automatic requests
  if (req.path === '/favicon.ico' || req.path.includes('.map')) {
    return next();
  }
  
  // Show different info for preflight vs actual requests
  if (req.method === 'OPTIONS') {
    console.log(`${new Date().toISOString()} - PREFLIGHT ${req.path}`);
  } else {
    const queryString = req.query && Object.keys(req.query).length 
      ? ` (query: ${JSON.stringify(req.query)})` 
      : '';
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}${queryString}`);
  }
  next();
});

/*----------- Helpers, middleware, setup ------------*/

// Add CORS middleware to allow connections from anywhere
// You'd typically restrict this in production to specific origins
// In this case, allowed origins should be the BFF backend,
// TMB frontend, and BBOC frontend
// For the sake of simplicity, we allow all origins so you don't
// have to manage .env synchronization across multiple architecture demos 
app.use(cors({
  origin: '*'
}));

// Set up protected API routes
resourceApi(app, verifyJWT);

/*----------- Non-specified routes ------------*/

app.all('*', async (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/*----------- Start the server ------------*/

// npm run dev
async function startServer() {
  const serverURL = await getServerURL();
  
  app.listen(port, () => {
    console.log(`Server started at ${serverURL}`);
  });
}

startServer().catch(console.error);
