import FusionAuthClient from "@fusionauth/typescript-client";
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Import utility functions
import { validateEnvironmentVariables } from './utils/config';
import { setupAuthRoutes } from './auth';
import { api } from './api';

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

// Set up app
const app = express();
const port = process.env.PORT || 4001;

// Decode form URL encoded data
app.use(express.urlencoded({ extended: true }));

// Parse JSON bodies
app.use(express.json());

// Enhanced request logging middleware
app.use((req, res, next) => {
  // Skip logging for favicon and other browser automatic requests
  if (req.path === '/favicon.ico' || req.path.includes('.map')) {
    return next();
  }
  
  // Show different info for preflight vs actual requests
  if (req.method === 'OPTIONS') {
    console.log(`${new Date().toISOString()} - PREFLIGHT ${req.path}`);
  } else {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}${req.query && Object.keys(req.query).length ? ` (query: ${JSON.stringify(req.query)})` : ''}`);
  }
  next();
});

// Validate and extract required environment variables
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'FUSIONAUTH_URL', 'FRONTEND_URL', 'BACKEND_URL'];
const config = validateEnvironmentVariables(requiredEnvVars);
const { CLIENT_ID: clientId, CLIENT_SECRET: clientSecret, FUSIONAUTH_URL: fusionAuthURL, FRONTEND_URL: frontendURL, BACKEND_URL: backendURL } = config;

// Initialize FusionAuth client
const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

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
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}${req.query && Object.keys(req.query).length ? ` (query: ${JSON.stringify(req.query)})` : ''}`);
  }
  next();
});

/*----------- Helpers, middleware, setup ------------*/

// Cookie setup
app.use(cookieParser());

// Add CORS middleware to allow connections from frontend
app.use(cors({
  origin: frontendURL,
  credentials: true
}));

// Set up auth API and get the secure middleware
const authApi = setupAuthRoutes(app, client, clientId, clientSecret, fusionAuthURL, frontendURL, backendURL);

// Set up protected API routes
api(app, authApi);

/*----------- Health check endpoint ------------*/

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'tmb-backend' 
  });
});

/*----------- Non-specified routes ------------*/

// Handle API routes that don't exist
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.all('/auth/*', (req, res) => {
  res.status(404).json({ error: 'Auth endpoint not found' });
});

// Redirect all other un-named routes to the frontend homepage
app.all('*', async (req, res) => {
  res.redirect(302, frontendURL);
});

/*----------- Start the server ------------*/

// npm run dev
app.listen(port, () => {
  console.log(`Server started at ${backendURL}`);
});
