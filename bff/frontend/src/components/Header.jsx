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
      <NavLink to="/" className="site-brand">
        <div className="site-brand-icon">
          <img src="https://fusionauth.io/img/favicon.png" alt="BFF Auth" />
        </div>
        <div className="site-brand-text">
          <span className="site-brand-main">BFF Auth</span>
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