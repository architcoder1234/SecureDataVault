// =============================================================================
// FILE: src/components/PasswordStrengthMeter.jsx
// PURPOSE: Live password strength indicator shown during registration
// =============================================================================

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const checks = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    number:  /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const levels = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["", "#ff3355", "#ff8800", "#ffaa00", "#00cc6a", "#00ff88"];
  const widths = ["0%", "20%", "40%", "60%", "80%", "100%"];

  return (
    <div className="strength-meter">
      <div className="strength-bar-track">
        <div
          className="strength-bar-fill"
          style={{ width: widths[score], background: colors[score], transition: "all 0.3s" }}
        />
      </div>
      <div className="strength-labels">
        <span style={{ color: colors[score], fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
          {levels[score]}
        </span>
        <div className="strength-checks">
          {[
            { key: "length",  label: "8+ chars" },
            { key: "upper",   label: "A-Z" },
            { key: "lower",   label: "a-z" },
            { key: "number",  label: "0-9" },
            { key: "special", label: "!@#" },
          ].map(({ key, label }) => (
            <span key={key} className={`check-pill ${checks[key] ? "check-ok" : "check-no"}`}>
              {checks[key] ? "✓" : "○"} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
