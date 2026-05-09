// =============================================================================
// FILE: src/components/TrustStatus.jsx
// PURPOSE: Shows real-time security status (SSL, connection type, vault status)
// =============================================================================

import { useState, useEffect } from "react";

const API = "http://localhost:5000/api";

export default function TrustStatus() {
  const [vaultStatus, setVaultStatus] = useState(null);
  const [connectionType, setConnectionType] = useState("checking...");

  useEffect(() => {
    // Check if the current page is served over HTTPS
    const isHttps = window.location.protocol === "https:";
    setConnectionType(isHttps ? "HTTPS (Encrypted)" : "HTTP (Not Encrypted — Dev Mode)");

    // Fetch backend status
    fetch(`${API}/status`)
      .then((res) => res.json())
      .then((data) => setVaultStatus(data))
      .catch(() => setVaultStatus({ status: "❌ Cannot reach backend server" }));
  }, []);

  const isSecure = window.location.protocol === "https:";

  return (
    <div className={`trust-banner ${isSecure ? "trust-secure" : "trust-dev"}`}>
      <div className="trust-items">
        {/* Connection status */}
        <div className="trust-item">
          <span className="trust-icon">{isSecure ? "🔒" : "⚠️"}</span>
          <div>
            <strong>Connection</strong>
            <p>{connectionType}</p>
          </div>
        </div>

        {/* Vault backend status */}
        <div className="trust-item">
          <span className="trust-icon">🏛️</span>
          <div>
            <strong>Vault Server</strong>
            <p>{vaultStatus ? vaultStatus.status : "Connecting..."}</p>
          </div>
        </div>

        {/* Encryption info from backend */}
        {vaultStatus && (
          <>
            <div className="trust-item">
              <span className="trust-icon">🔑</span>
              <div>
                <strong>Data at Rest</strong>
                <p>{vaultStatus.symmetric_encryption}</p>
              </div>
            </div>

            <div className="trust-item">
              <span className="trust-icon">📜</span>
              <div>
                <strong>Signatures</strong>
                <p>{vaultStatus.digital_signatures}</p>
              </div>
            </div>

            <div className="trust-item">
              <span className="trust-icon">🛡️</span>
              <div>
                <strong>Passwords</strong>
                <p>{vaultStatus.password_hashing}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dev mode warning */}
      {!isSecure && (
        <div className="trust-warning">
          ℹ️ Running in HTTP development mode. See <strong>SETUP_GUIDE.md</strong> to enable HTTPS with a self-signed certificate.
        </div>
      )}
    </div>
  );
}
