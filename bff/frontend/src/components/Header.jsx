import { NavLink } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function Header() {
  const { loggedIn, userInfo } = useAuth();

  // OAuth 2.0 routes
  const initLogin = () => {
    window.location.href = 'http://localhost:4001/auth/login';
  };
  const initLogout = () => {
    window.location.href = 'http://localhost:4001/auth/logout';
  };

  return (
    <header>
      {loggedIn ? (
        <div className="header-auth">
          <p className="header-email">{userInfo?.email}</p>
          <button
            className="btn btn-logout"
            style={{ cursor: "pointer" }}
            onClick={initLogout}
          >
            Log out
          </button>
        </div>
      ) : (
        <button
          className="btn btn-login"
          style={{ cursor: "pointer" }}
          onClick={initLogin}
        >
          Log in
        </button>
      )}
      <nav className="header-nav">
        <NavLink to="/" className="nav-link">Home</NavLink>
        { loggedIn ? <NavLink to="/protected" className="nav-link">Protected Page</NavLink> : ''}
      </nav>
    </header>
  );
}