// =============================================================================
// FILE: src/components/OWASPChecklist.jsx
// PURPOSE: Collapsible panel showing which OWASP Top 10 rules are active
// =============================================================================

import { useState } from "react";

const ITEMS = [
  {
    id: "A01", label: "Broken Access Control",
    status: "fixed",
    detail: "JWT token verified server-side on every protected route. user_id comes from token, never from user input — prevents IDOR attacks.",
  },
  {
    id: "A02", label: "Cryptographic Failures",
    status: "fixed",
    detail: "AES-256 encrypts all notes at rest. bcrypt (rounds=12) hashes passwords. RSA-2048 signs every note. No hardcoded keys — all stored in .env.",
  },
  {
    id: "A03", label: "SQL Injection",
    status: "fixed",
    detail: "Every database query uses parameterized placeholders (?). User input is never concatenated into SQL strings.",
  },
  {
    id: "A04", label: "Insecure Design",
    status: "fixed",
    detail: "RSA signature is verified BEFORE decryption. Tampered notes are blocked and flagged, never decrypted.",
  },
  {
    id: "A05", label: "Security Misconfiguration",
    status: "fixed",
    detail: "CORS restricted to localhost:5173. debug=False in Flask. Error stack traces logged to file, never sent to client.",
  },
  {
    id: "A07", label: "Auth & Session Failures",
    status: "fixed",
    detail: "Same error message for wrong username OR wrong password (prevents enumeration). Rate limited to 5 login attempts/minute. Tokens expire in 2 hours.",
  },
  {
    id: "A08", label: "Integrity Failures",
    status: "fixed",
    detail: "Digital signatures (RSA-PSS + SHA-256) detect any tampering with stored notes. Invalid signatures block decryption.",
  },
  {
    id: "A09", label: "Logging Failures",
    status: "fixed",
    detail: "RotatingFileHandler logs all errors with tracebacks to vault_errors.log. Generic messages sent to users. Log files rotate at 5MB.",
  },
  {
    id: "A06", label: "Vulnerable Components",
    status: "partial",
    detail: "Using pinned, modern versions of all libraries. Recommend running `pip audit` and `npm audit` periodically to check for CVEs.",
  },
  {
    id: "A10", label: "Server-Side Request Forgery",
    status: "na",
    detail: "Not applicable — this app does not make server-side HTTP requests to external URLs.",
  },
];

export default function OWASPChecklist() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fixed   = ITEMS.filter(i => i.status === "fixed").length;
  const partial = ITEMS.filter(i => i.status === "partial").length;

  return (
    <div className="owasp-panel vault-section">
      <button className="owasp-toggle" onClick={() => setOpen(o => !o)}>
        <div className="owasp-toggle-left">
          <span className="section-title" style={{ marginBottom: 0 }}>
            🛡️ OWASP TOP 10 CHECKLIST
          </span>
          <span className="owasp-score">
            <span className="score-fixed">{fixed} fixed</span>
            <span className="score-partial">{partial} partial</span>
          </span>
        </div>
        <span className="owasp-chevron">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="owasp-list">
          {ITEMS.map(item => (
            <div
              key={item.id}
              className={`owasp-item owasp-${item.status}`}
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            >
              <div className="owasp-row">
                <span className="owasp-badge">{item.id}</span>
                <span className="owasp-label">{item.label}</span>
                <span className={`owasp-status-pill status-${item.status}`}>
                  {item.status === "fixed"   ? "✅ Fixed"    : ""}
                  {item.status === "partial" ? "⚠️ Partial"  : ""}
                  {item.status === "na"      ? "➖ N/A"       : ""}
                </span>
              </div>
              {expanded === item.id && (
                <p className="owasp-detail">{item.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
