import { NavLink } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { useCallback } from 'react';

export default function Header() {
  const { loggedIn, userInfo, login, logout } = useAuth();

  const initLogin = useCallback(() => {
    login();
  }, [login]);

  const initLogout = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <header>
      <NavLink to="/" className="site-brand">
        <div className="site-brand-icon">
          <img src="https://fusionauth.io/img/favicon.png" alt="BBOC Auth" />
        </div>
        <div className="site-brand-text">
          <span className="site-brand-main">BBOC Auth</span>
          <span className="site-brand-sub">Architecture</span>
        </div>
      </NavLink>
      <nav className="header-nav">
        <NavLink to="/" className="nav-link">Home</NavLink>
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