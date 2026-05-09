// =============================================================================
// FILE: src/components/StatsPanel.jsx
// PURPOSE: Dashboard stats bar — note count, pinned count, last active
// =============================================================================

export default function StatsPanel({ notes, username }) {
  const total   = notes.length;
  const pinned  = notes.filter(n => n.pinned).length;
  const tampered = notes.filter(n => n.integrity === "tampered").length;
  const verified = notes.filter(n => n.integrity === "verified").length;

  const lastNote = notes.length > 0
    ? new Date(notes[0].created_at).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      })
    : "—";

  return (
    <div className="stats-panel">
      <div className="stat-item">
        <span className="stat-value">{total}</span>
        <span className="stat-label">Total Notes</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value stat-green">{verified}</span>
        <span className="stat-label">Verified</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value stat-amber">{pinned}</span>
        <span className="stat-label">Pinned</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value stat-red">{tampered}</span>
        <span className="stat-label">Tampered</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value stat-cyan" style={{ fontSize: "0.95rem" }}>{lastNote}</span>
        <span className="stat-label">Last Note</span>
      </div>
    </div>
  );
}
