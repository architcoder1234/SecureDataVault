// =============================================================================
// FILE: src/components/NotesList.jsx
// NEW: Edit modal, pin button, copy to clipboard, relative timestamps,
//      tamper demo button, slide-in animations
// =============================================================================

import { useState } from "react";

// Relative time helper
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotesList({ notes, loading, onDelete, onEdit, onPin, onTamperDemo, onRefresh, searchActive }) {
  if (loading) {
    return (
      <div className="notes-loading">
        <div className="spinner" />
        <p>Verifying signatures &amp; decrypting...</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="notes-empty">
        {searchActive
          ? "🔍 No notes match your search."
          : "🔒 Your vault is empty. Add your first secret note above!"}
      </div>
    );
  }

  return (
    <div className="notes-list">
      <div className="notes-actions">
        <button className="btn-refresh" onClick={onRefresh}>🔄 Refresh</button>
      </div>
      {notes.map((note, i) => (
        <NoteCard
          key={note.id} note={note} index={i}
          onDelete={onDelete} onEdit={onEdit}
          onPin={onPin} onTamperDemo={onTamperDemo}
        />
      ))}
    </div>
  );
}

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, index, onDelete, onEdit, onPin, onTamperDemo }) {
  const [showDelete,  setShowDelete]  = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editText,    setEditText]    = useState(note.content);
  const [editLoading, setEditLoading] = useState(false);
  const [copied,      setCopied]      = useState(false);

  const cardClass = {
    verified:       "note-card note-verified",
    tampered:       "note-card note-tampered",
    decrypt_failed: "note-card note-failed",
  }[note.integrity] || "note-card note-verified";

  const handleCopy = () => {
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setEditLoading(true);
    const ok = await onEdit(note.id, editText.trim());
    setEditLoading(false);
    if (ok) setEditing(false);
  };

  const updatedLabel = note.updated_at && note.updated_at !== note.created_at
    ? `edited ${timeAgo(note.updated_at)}`
    : null;

  return (
    <div
      className={cardClass}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Pin ribbon */}
      {note.pinned && <div className="pin-ribbon">📌 Pinned</div>}

      {/* Header row */}
      <div className="note-header">
        <span className={`integrity-badge badge-${note.integrity}`}>
          {note.integrity === "verified"       ? "✅ Verified"       : ""}
          {note.integrity === "tampered"       ? "⚠️ Tampered"       : ""}
          {note.integrity === "decrypt_failed" ? "❌ Decrypt Failed" : ""}
        </span>
        <div className="note-meta">
          {updatedLabel && <span className="note-updated">{updatedLabel}</span>}
          <span className="note-date">🕐 {timeAgo(note.created_at)}</span>
        </div>
      </div>

      {/* Content or Edit Mode */}
      {editing ? (
        <div className="edit-mode">
          <textarea
            className="note-textarea edit-textarea"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={4} maxLength={5000} autoFocus
          />
          <div className="edit-actions">
            <button className="btn-save-edit" onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? "⏳ Saving..." : "💾 Save"}
            </button>
            <button className="btn-cancel" onClick={() => { setEditing(false); setEditText(note.content); }}>
              Cancel
            </button>
            <span className="char-count" style={{ marginLeft: "auto" }}>{editText.length}/5000</span>
          </div>
        </div>
      ) : (
        <div className="note-content">
          {note.integrity === "tampered"
            ? <em style={{ color: "var(--red)", opacity: 0.8 }}>
                ⚠️ Content hidden — RSA signature check failed. This note was tampered with.
              </em>
            : note.content}
        </div>
      )}

      {/* Action buttons */}
      {!editing && (
        <div className="note-footer">
          <div className="note-actions-row">
            {/* Pin */}
            <button
              className={`btn-note-action ${note.pinned ? "btn-pinned" : ""}`}
              onClick={() => onPin(note.id)}
              title={note.pinned ? "Unpin" : "Pin to top"}
            >
              {note.pinned ? "📌 Unpin" : "📌 Pin"}
            </button>

            {/* Copy — only for verified notes */}
            {note.integrity === "verified" && (
              <button className="btn-note-action" onClick={handleCopy} title="Copy to clipboard">
                {copied ? "✅ Copied!" : "📋 Copy"}
              </button>
            )}

            {/* Edit — only for verified notes */}
            {note.integrity === "verified" && (
              <button className="btn-note-action" onClick={() => setEditing(true)} title="Edit note">
                ✏️ Edit
              </button>
            )}

            {/* Tamper Demo */}
            {note.integrity === "verified" && (
              <button
                className="btn-note-action btn-tamper"
                onClick={() => onTamperDemo(note.id)}
                title="Demo: corrupt this note to test RSA signature detection"
              >
                🔬 Tamper Demo
              </button>
            )}

            {/* Delete */}
            <div className="note-action-right">
              {!showDelete ? (
                <button className="btn-delete-init" onClick={() => setShowDelete(true)}>
                  🗑️ Delete
                </button>
              ) : (
                <div className="delete-confirm">
                  <span>Sure?</span>
                  <button className="btn-delete-confirm" onClick={() => onDelete(note.id)}>Yes</button>
                  <button className="btn-cancel" onClick={() => setShowDelete(false)}>No</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
