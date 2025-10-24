import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import './index.css'
import App from './App.jsx'
import { FusionAuthProvider } from "@fusionauth/react-sdk";

const clientId = import.meta.env.VITE_CLIENT_ID;
const authzServerUrl = import.meta.env.VITE_AUTHZ_SERVER_URL || 'http://localhost:9011';
const frontendUrl = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173';

const config = {
  clientId: clientId,
  redirectUri: frontendUrl,
  postLogoutRedirectUri: frontendUrl,
  serverUrl: authzServerUrl,
  shouldAutoFetchUserInfo: true,
  shouldAutoRefresh: true,
  scope: 'openid email profile offline_access'
};

createRoot(document.getElementById('root')).render(
  // <StrictMode> // Commented out for development to avoid double requests
    <BrowserRouter>
      <FusionAuthProvider {...config}>
        <App />
      </FusionAuthProvider>
    </BrowserRouter>
  // </StrictMode>
);
