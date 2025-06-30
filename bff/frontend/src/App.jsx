import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './services/AuthContext';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedPage from './pages/ProtectedPage';
import './App.css'

function App() {
  const { checkSession } = useAuth();
  const location = useLocation();

  useEffect(() => {
    checkSession();
  }, [location, checkSession]);

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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  )
}

export default App;