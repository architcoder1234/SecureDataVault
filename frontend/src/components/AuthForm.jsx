// =============================================================================
// FILE: src/components/AuthForm.jsx
// NEW: Password strength meter on register, improved validation UX
// =============================================================================

import { useState } from "react";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

const API = "http://localhost:5000/api";

export default function AuthForm({ onLoginSuccess }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const validate = () => {
    if (!username.trim() || !password.trim()) return "Username and password are required.";
    if (username.length < 3) return "Username must be at least 3 characters.";
    if (!/^[a-zA-Z0-9]+$/.test(username)) return "Username: letters and numbers only.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (mode === "register" && password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      if (mode === "register") {
        setSuccess("Account created! You can now log in.");
        setMode("login"); setPassword(""); setConfirmPassword("");
      } else {
        onLoginSuccess(data.token, data.username);
      }
    } catch {
      setError("Cannot connect to vault server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => { setMode(m); setError(""); setSuccess(""); setPassword(""); setConfirmPassword(""); };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-icon">🔐</div>
        <h2>{mode === "login" ? "Unlock Your Vault" : "Create a Vault"}</h2>
        <p className="auth-subtitle">// encrypted &amp; secure storage system</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>Login</button>
          <button className={`auth-tab ${mode === "register" ? "active" : ""}`} onClick={() => switchMode("register")}>Register</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="field-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Letters and numbers only"
              autoComplete="username" maxLength={30} disabled={loading} />
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-toggle">
              <input id="password" type={showPass ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                disabled={loading} />
              <button type="button" className="btn-show-pass"
                onClick={() => setShowPass(p => !p)}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Live strength meter — only on register */}
          {mode === "register" && <PasswordStrengthMeter password={password} />}

          {mode === "register" && (
            <div className="field-group">
              <label htmlFor="confirm">Confirm Password</label>
              <input id="confirm" type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password" disabled={loading} />
            </div>
          )}

          {error   && <div className="msg-error">⚠️ {error}</div>}
          {success && <div className="msg-success">✅ {success}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "⏳ Please wait..." : mode === "login" ? "🔓 Login" : "🔒 Create Account"}
          </button>
        </form>

        <div className="auth-security-info">
          <p>🛡️ <strong>How your password is protected:</strong></p>
          <p>Hashed with <strong>bcrypt (rounds=12)</strong> before storage. The plain password is never stored or seen — not even by the server admin.</p>
        </div>
      </div>
    </div>
  );
}
