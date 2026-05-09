# =============================================================================
# FILE: database.py — SQLite + Parameterized Queries (OWASP Anti-SQLi)
# NEW:  update_note(), toggle_pin_note(), pinned + updated_at columns
# =============================================================================

import sqlite3, logging, os

logger = logging.getLogger(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "vault.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    UNIQUE NOT NULL,
                password_hash TEXT    NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""")
        c.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL,
                encrypted_note TEXT    NOT NULL,
                signature      TEXT    NOT NULL,
                pinned         INTEGER DEFAULT 0,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )""")
        # Add columns if upgrading from old DB
        try: c.execute("ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0")
        except: pass
        try: c.execute("ALTER TABLE notes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        except: pass
        conn.commit()
        logger.info("Database initialized.")
    except Exception as e:
        logger.error(f"DB init failed: {e}")
        raise
    finally:
        conn.close()

# ── Users ─────────────────────────────────────────────────────────────────────
def create_user(username, password_hash):
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)",
                  (username, password_hash))
        conn.commit()
        return c.lastrowid
    except sqlite3.IntegrityError:
        raise ValueError("Username already exists.")
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

# ── Notes ─────────────────────────────────────────────────────────────────────
def save_note(user_id, encrypted_note, signature):
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute(
            "INSERT INTO notes (user_id, encrypted_note, signature) VALUES (?, ?, ?)",
            (user_id, encrypted_note, signature))
        conn.commit()
        return c.lastrowid
    finally:
        conn.close()

def get_notes_by_user(user_id):
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute(
            "SELECT * FROM notes WHERE user_id = ? ORDER BY pinned DESC, created_at DESC",
            (user_id,))
        return [dict(row) for row in c.fetchall()]
    finally:
        conn.close()

def update_note(note_id, user_id, encrypted_note, signature):
    """Re-encrypts and re-signs an edited note. Returns True if updated."""
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            UPDATE notes
            SET encrypted_note = ?, signature = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        """, (encrypted_note, signature, note_id, user_id))
        conn.commit()
        return c.rowcount > 0
    finally:
        conn.close()

def delete_note(note_id, user_id):
    """Delete only if the note belongs to the user (prevents IDOR)."""
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id))
        conn.commit()
        return c.rowcount > 0
    finally:
        conn.close()

def toggle_pin_note(note_id, user_id):
    """Toggles pinned state. Returns new pinned value (True/False) or None."""
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT pinned FROM notes WHERE id = ? AND user_id = ?",
                  (note_id, user_id))
        row = c.fetchone()
        if not row:
            return None
        new_val = 0 if row["pinned"] else 1
        c.execute("UPDATE notes SET pinned = ? WHERE id = ? AND user_id = ?",
                  (new_val, note_id, user_id))
        conn.commit()
        return bool(new_val)
    finally:
        conn.close()
