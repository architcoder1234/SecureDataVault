// =============================================================================
// FILE: src/App.jsx — Root component with theme toggle + auto-logout support
// =============================================================================

import { useState, useEffect } from "react";
import AuthForm from "./components/AuthForm";
import VaultDashboard from "./components/VaultDashboard";
import TrustStatus from "./components/TrustStatus";
import "./App.css";

export default function App() {
  const [auth, setAuth]       = useState(null);
  const [appReady, setAppReady] = useState(false);
  const [theme, setTheme]     = useState("dark");

  useEffect(() => {
    const savedToken    = sessionStorage.getItem("vault_token");
    const savedUsername = sessionStorage.getItem("vault_username");
    if (savedToken && savedUsername) setAuth({ token: savedToken, username: savedUsername });
    const savedTheme = localStorage.getItem("vault_theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    setAppReady(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("vault_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogin = (token, username) => {
    sessionStorage.setItem("vault_token", token);
    sessionStorage.setItem("vault_username", username);
    setAuth({ token, username });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("vault_token");
    sessionStorage.removeItem("vault_username");
    setAuth(null);
  };

  if (!appReady) return null;

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-left">
          <span className="header-lock">🔒</span>
          <h1 className="header-title">Secure Data Vault</h1>
        </div>
        <div className="header-right">
          <button className="btn-theme" onClick={toggleTheme}>
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          {auth && (
            <>
              <span className="header-user">{auth.username}</span>
              <button className="btn-logout" onClick={handleLogout}>[ logout ]</button>
            </>
          )}
        </div>
      </header>

      <TrustStatus />

      <main className="app-main">
        {auth ? (
          <VaultDashboard
            token={auth.token}
            username={auth.username}
            onLogout={handleLogout}
          />
        ) : (
          <AuthForm onLoginSuccess={handleLogin} />
        )}
      </main>

      <footer className="app-footer">
        AES-256 &nbsp;//&nbsp; RSA-2048 &nbsp;//&nbsp; bcrypt &nbsp;//&nbsp;
        OWASP &nbsp;//&nbsp; Rate Limiting &nbsp;//&nbsp; Parameterized Queries
      </footer>
    </div>
  );
}
