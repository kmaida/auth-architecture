import { useState } from 'react';

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Use state for login status
  const userInfo = { email: "kim.maida@fusionauth.io" }; // Placeholder for user info

  const initLogin = () => {
    console.log('Call localhost:3000/auth/login');
    setIsLoggedIn(true);
  };
  const initLogout = () => {
    console.log('Call localhost:3000/auth/logout');
    setIsLoggedIn(false);
  };

  return (
    <header>
      {isLoggedIn ? (
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
    </header>
  );
}