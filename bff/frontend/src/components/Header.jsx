import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';


export default function Header() {
  // const [loggedIn, setLoggedIn] = useState(true); // Use state for login status
  const userInfo = { email: "kim.maida@fusionauth.io" }; // Placeholder for user info

  const { loggedIn, setLoggedIn } = useAuth();

  const initLogin = () => {
    console.log('Call localhost:3000/auth/login');
    setLoggedIn(true);
  };
  const initLogout = () => {
    console.log('Call localhost:3000/auth/logout');
    setLoggedIn(false);
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