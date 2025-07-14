import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './services/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/ProtectedRoute';
import ProfilePage from './pages/ProfilePage';
import LoginCallbackPage from './pages/LoginCallback';
import LogoutCallbackPage from './pages/LogoutCallback';
import ResourceApiPage from './pages/ResourceApiPage';
import './App.css'

function App() {
  const { checkSession, loggedIn } = useAuth();

  // Check authentication session on initial load only
  useEffect(() => {
    checkSession();
  }, []);

  // Add body class for authentication state
  useEffect(() => {
    document.body.classList.toggle('logged-in', loggedIn);
    document.body.classList.toggle('logged-out', !loggedIn);
    // Cleanup
    return () => {
      document.body.classList.remove('logged-in', 'logged-out');
    };
  }, [loggedIn]);

  return (
    <>
      <Header />
      <div className="container-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login/callback" element={<LoginCallbackPage />} />
          <Route path="/logout/callback" element={<LogoutCallbackPage />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/call-api"
            element={
              <ProtectedRoute>
                <ResourceApiPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <Footer />
    </>
  )
}

export default App;