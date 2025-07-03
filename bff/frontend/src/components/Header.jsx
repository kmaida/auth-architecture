import { NavLink } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useCallback } from 'react';

export default function Header() {
  const { loggedIn, userInfo } = useAuth();
  const apiUrl = import.meta.env.VITE_API_URL;

  const initLogin = useCallback(() => {
    window.location.href = `${apiUrl}/auth/login`;
  }, [apiUrl]);

  const initLogout = useCallback(() => {
    window.location.href = `${apiUrl}/auth/logout`;
  }, [apiUrl]);

  return (
    <header>
      <nav className="header-nav">
        <NavLink to="/" className="nav-link">Home</NavLink>
        { loggedIn ? <NavLink to="/protected" className="nav-link">Protected Page</NavLink> : ''}
        { loggedIn ? <NavLink to="/profile" className="nav-link">Profile</NavLink> : ''}
      </nav>
      {loggedIn ? (
        <div className="header-auth">
          <p className="header-email">{userInfo?.email}</p>
          <button
            className="btn btn-logout"
            onClick={initLogout}
          >
            Log Out
          </button>
        </div>
      ) : (
        <button
          className="btn btn-login"
          onClick={initLogin}
        >
          Log In
        </button>
      )}
    </header>
  );
}