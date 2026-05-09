// =============================================================================
// FILE: src/components/VaultDashboard.jsx
// NEW: Search, edit notes, pin, export vault, tamper demo, auto-logout on idle
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import NotesList from "./NotesList";
import StatsPanel from "./StatsPanel";
import OWASPChecklist from "./OWASPChecklist";

const API = "http://localhost:5000/api";
const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export default function VaultDashboard({ token, username, onLogout }) {
  const [noteText, setNoteText]     = useState("");
  const [notes, setNotes]           = useState([]);
  const [search, setSearch]         = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [addError, setAddError]     = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [rsaMessage, setRsaMessage] = useState("");
  const [rsaResult, setRsaResult]   = useState(null);
  const [rsaLoading, setRsaLoading] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const idleTimer = useRef(null);
  const warnTimer = useRef(null);

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  // ── Auto-Logout on Idle ────────────────────────────────────────────────────
  const resetIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
    setIdleWarning(false);
    // Warn at 9 mins
    warnTimer.current = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT - 60000);
    // Logout at 10 mins
    idleTimer.current = setTimeout(() => {
      if (onLogout) onLogout();
    }, IDLE_TIMEOUT);
  }, [onLogout]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimer.current);
      clearTimeout(warnTimer.current);
    };
  }, [resetIdleTimer]);

  // ── Fetch Notes ────────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    setFetchLoading(true);
    try {
      const res  = await fetch(`${API}/notes`, { headers: authHeaders });
      const data = await res.json();
      if (res.ok) setNotes(data.notes || []);
    } catch { /* silent */ }
    finally { setFetchLoading(false); }
  }, [token]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // ── Add Note ───────────────────────────────────────────────────────────────
  const handleAddNote = async (e) => {
    e.preventDefault();
    setAddError(""); setAddSuccess("");
    const trimmed = noteText.trim();
    if (!trimmed) { setAddError("Note cannot be empty."); return; }
    if (trimmed.length > 5000) { setAddError("Note exceeds 5000 characters."); return; }
    setAddLoading(true);
    try {
      const res  = await fetch(`${API}/notes`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ note: trimmed })
      });
      const data = await res.json();
      if (res.ok) {
        setAddSuccess(`Encrypted! Preview: ${data.encrypted_preview}`);
        setNoteText(""); fetchNotes();
      } else { setAddError(data.error || "Failed to save."); }
    } catch { setAddError("Cannot connect to vault server."); }
    finally { setAddLoading(false); }
  };

  // ── Edit Note ──────────────────────────────────────────────────────────────
  const handleEditNote = async (noteId, newText) => {
    try {
      const res = await fetch(`${API}/notes/${noteId}`, {
        method: "PUT", headers: authHeaders,
        body: JSON.stringify({ note: newText })
      });
      if (res.ok) fetchNotes();
      return res.ok;
    } catch { return false; }
  };

  // ── Delete Note ────────────────────────────────────────────────────────────
  const handleDeleteNote = async (noteId) => {
    try {
      const res = await fetch(`${API}/notes/${noteId}`, {
        method: "DELETE", headers: authHeaders
      });
      if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { /* silent */ }
  };

  // ── Pin Note ───────────────────────────────────────────────────────────────
  const handlePinNote = async (noteId) => {
    try {
      const res = await fetch(`${API}/notes/${noteId}/pin`, {
        method: "PATCH", headers: authHeaders
      });
      if (res.ok) fetchNotes();
    } catch { /* silent */ }
  };

  // ── Export Vault ───────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const res  = await fetch(`${API}/export`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) return;
      const blob = new Blob([JSON.stringify(data, null, 2)],
                             { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `vault_export_${username}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  // ── Tamper Demo ────────────────────────────────────────────────────────────
  const handleTamperDemo = async (noteId) => {
    try {
      const res  = await fetch(`${API}/demo/tamper/${noteId}`, {
        method: "POST", headers: authHeaders
      });
      const data = await res.json();
      if (res.ok) { fetchNotes(); alert(`🔬 Demo: ${data.message}`); }
    } catch { /* silent */ }
  };

  // ── RSA Demo ───────────────────────────────────────────────────────────────
  const handleRsaDemo = async (e) => {
    e.preventDefault(); setRsaResult(null);
    if (!rsaMessage.trim()) return;
    setRsaLoading(true);
    try {
      const res  = await fetch(`${API}/demo/rsa-encrypt`, {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ message: rsaMessage.trim() })
      });
      const data = await res.json();
      if (res.ok) setRsaResult(data);
    } catch { /* silent */ }
    finally { setRsaLoading(false); }
  };

  // ── Filtered Notes ─────────────────────────────────────────────────────────
  const filteredNotes = notes.filter(n =>
    !search || n.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard">

      {/* Idle Warning Banner */}
      {idleWarning && (
        <div className="idle-warning">
          ⏰ You'll be logged out in 1 minute due to inactivity.
          <button onClick={resetIdleTimer} className="btn-stay">Stay Logged In</button>
        </div>
      )}

      {/* Stats Panel */}
      <StatsPanel notes={notes} username={username} />

      {/* Add Note */}
      <section className="vault-section">
        <h2 className="section-title">📝 Add a Secret Note</h2>
        <p className="section-desc">
          Your note will be <strong>AES-256 encrypted</strong> and <strong>RSA-2048 signed</strong> before storage. The plain text never touches the database.
        </p>
        <form onSubmit={handleAddNote} className="note-form" noValidate>
          <textarea className="note-textarea" value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Type your secret note here..." rows={5}
            maxLength={5000} disabled={addLoading} />
          <div className="char-count">{noteText.length} / 5000</div>
          {addError   && <div className="msg-error">⚠️ {addError}</div>}
          {addSuccess && <div className="msg-success">✅ {addSuccess}</div>}
          <button type="submit" className="btn-primary" disabled={addLoading}>
            {addLoading ? "⏳ Encrypting..." : "🔒 Encrypt & Save Note"}
          </button>
        </form>
      </section>

      {/* Vault / Notes List */}
      <section className="vault-section">
        <div className="vault-header-row">
          <div>
            <h2 className="section-title">🗄️ Your Vault ({notes.length} notes)</h2>
            <p className="section-desc">
              Each note is <strong>signature-verified</strong> before decryption. Pinned notes appear first.
            </p>
          </div>
          <button className="btn-export" onClick={handleExport} title="Export all notes as JSON">
            📥 Export
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input type="text" className="search-input"
            placeholder="Search your notes..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <NotesList
          notes={filteredNotes}
          loading={fetchLoading}
          onDelete={handleDeleteNote}
          onEdit={handleEditNote}
          onPin={handlePinNote}
          onTamperDemo={handleTamperDemo}
          onRefresh={fetchNotes}
          searchActive={!!search}
        />
      </section>

      {/* RSA Demo */}
      <section className="vault-section demo-section">
        <h2 className="section-title">🔬 RSA Encryption Demo</h2>
        <p className="section-desc">
          Type any short message — the server encrypts it with <strong>RSA-2048 public key</strong>. Only the server's private key can decrypt it.
        </p>
        <form onSubmit={handleRsaDemo} className="demo-form" noValidate>
          <input type="text" className="demo-input" value={rsaMessage}
            onChange={e => setRsaMessage(e.target.value)}
            placeholder="e.g. my-secret-aes-key"
            maxLength={200} disabled={rsaLoading} />
          <button type="submit" className="btn-secondary"
            disabled={rsaLoading || !rsaMessage.trim()}>
            {rsaLoading ? "⏳ Encrypting..." : "🔐 RSA Encrypt"}
          </button>
        </form>
        {rsaResult && (
          <div className="rsa-result">
            <p><strong>Original:</strong> {rsaResult.original}</p>
            <p><strong>RSA Ciphertext (Base64):</strong></p>
            <code className="cipher-text">{rsaResult.encrypted_rsa}</code>
            <p className="rsa-note">💡 {rsaResult.note}</p>
          </div>
        )}
      </section>

      {/* OWASP Checklist */}
      <OWASPChecklist />

    </div>
  );
}
