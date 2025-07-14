import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './services/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedPage from './pages/ProtectedPage';
import ProfilePage from './pages/ProfilePage';
import ResourceApiPage from './pages/ResourceApiPage';
import './App.css'

function App() {
  const { checkSession, loggedIn } = useAuth();

  // Check authentication session on initial load only
  useEffect(() => {
    checkSession();
  }, [checkSession]);

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
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <ProtectedPage />
              </ProtectedRoute>
            }
          />
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