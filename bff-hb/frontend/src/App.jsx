import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom';
import { useFusionAuth } from '@fusionauth/react-sdk';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedPage from './pages/ProtectedPage';
import ProfilePage from './pages/ProfilePage';
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
          <Route path="/logout/callback" element={<HomePage />} />
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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <Footer />
    </>
  )
}

export default App;