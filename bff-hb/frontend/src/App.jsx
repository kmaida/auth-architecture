import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom';
import { useFusionAuth } from '@fusionauth/react-sdk';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/ProtectedRoute';
import ProfilePage from './pages/ProfilePage';
import LogoutCallbackPage from './pages/LogoutCallback';
import ResourceApiPage from './pages/ResourceApiPage';
import './App.css'

function App() {
  const { isLoggedIn } = useFusionAuth();

  // Add body class for authentication state
  useEffect(() => {
    document.body.classList.toggle('logged-in', isLoggedIn);
    document.body.classList.toggle('logged-out', !isLoggedIn);
    // Cleanup
    return () => {
      document.body.classList.remove('logged-in', 'logged-out');
    };
  }, [isLoggedIn]);

  return (
    <>
      <Header />
      <div className="container-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
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