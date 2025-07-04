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

// Validate and extract required environment variables
const requiredEnvVars = ['CLIENT_ID', 'CLIENT_SECRET', 'FUSION_AUTH_URL', 'FRONTEND_URL', 'BACKEND_URL'];
const config = validateEnvironmentVariables(requiredEnvVars);
const { CLIENT_ID: clientId, CLIENT_SECRET: clientSecret, FUSION_AUTH_URL: fusionAuthURL, FRONTEND_URL: frontendURL, BACKEND_URL: backendURL } = config;

// Initialize FusionAuth client
const client = new FusionAuthClient('noapikeyneeded', fusionAuthURL);

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

/*----------- Non-specified routes ------------*/

// Redirect all other un-named routes to the frontend homepage
app.all('*', async (req, res) => {
  res.redirect(302, frontendURL);
});

/*----------- Start the server ------------*/

// npm run dev
app.listen(port, () => {
  console.log(`Server started at ${backendURL}`);
});
