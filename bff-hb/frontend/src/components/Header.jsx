import { NavLink } from 'react-router-dom';
import { useFusionAuth } from '@fusionauth/react-sdk';

export default function Header() {
  const { isLoggedIn, userInfo, startLogin, startLogout } = useFusionAuth();

  return (
    <header>
      <NavLink to="/" className="site-brand">
        <div className="site-brand-icon">
          <img src="https://fusionauth.io/img/favicon.png" alt="BFF-HB Auth" />
        </div>
        <div className="site-brand-text">
          <span className="site-brand-main">BFF-HB Auth</span>
          <span className="site-brand-sub">Architecture</span>
        </div>
      </NavLink>
      <nav className="header-nav">
        <NavLink to="/" className="nav-link">Home</NavLink>
        { isLoggedIn ? <NavLink to="/profile" className="nav-link">Profile</NavLink> : ''}
        {isLoggedIn ? <NavLink to="/call-api" className="nav-link">Call API</NavLink> : ''}
      </nav>
      {isLoggedIn ? (
        <div className="header-auth">
          <p className="header-email">{userInfo?.email}</p>
          <button
            className="btn btn-logout"
            onClick={() => startLogout()}
          >
            Log Out
          </button>
        </div>
      ) : (
        <button
          className="btn btn-login"
          onClick={() => startLogin()}
        >
          Log In
        </button>
      )}
    </header>
  );
}