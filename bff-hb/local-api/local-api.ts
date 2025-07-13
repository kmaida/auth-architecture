import express from 'express';
import cors from 'cors';
import verifyJWT from './verifyJWT';
import cookieParser from 'cookie-parser';

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

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Allow cookies to be sent with requests
}));

// Parse cookies and make them available in request
app.use(cookieParser());

/*----------- Protected Data Route ------------*/

app.get('/api/protected-data', verifyJWT, async (req, res) => {
  // Data that should be returned to authenticated users
  // Replace with your actual protected data
  const protectedData = {
    message: 'This is protected data that only authenticated users can access.'
  };
  res.status(200).json(protectedData);
});

/*----------- Non-specified routes ------------*/

app.all('*', async (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/*----------- Start the server ------------*/

// npm run dev
async function startServer() {
  const serverURL = `http://localhost:${port}`;

  app.listen(port, () => {
    console.log(`Server started at ${serverURL}`);
  });
}

startServer().catch(console.error);
