import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useCallback } from 'react';

export default function Header() {
  const { loggedIn, userInfo, setPreLoginPath, setAToken } = useAuth();
  const location = useLocation();
  const apiUrl = import.meta.env.VITE_API_URL;

  const initLogin = useCallback(() => {
    // Store current page path in AuthContext
    setPreLoginPath(location.pathname + location.search + location.hash);
    window.location.href = `${apiUrl}/auth/login`;
  }, [apiUrl, location, setPreLoginPath]);

  const initLogout = useCallback(() => {
    setAToken(undefined);
    window.location.href = `${apiUrl}/auth/logout`;
  }, [apiUrl, setAToken]);

  return (
    <header>
      <NavLink to="/" className="site-brand">
        <div className="site-brand-icon">
          <img src="https://fusionauth.io/img/favicon.png" alt="TMB Auth" />
        </div>
        <div className="site-brand-text">
          <span className="site-brand-main">TMB Auth</span>
          <span className="site-brand-sub">Architecture</span>
        </div>
      </NavLink>
      <nav className="header-nav">
        <NavLink to="/" className="nav-link">Home</NavLink>
        { loggedIn ? <NavLink to="/protected" className="nav-link">Protected</NavLink> : ''}
        { loggedIn ? <NavLink to="/profile" className="nav-link">Profile</NavLink> : ''}
        { loggedIn ? <NavLink to="/call-api" className="nav-link">Call API</NavLink> : ''}
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