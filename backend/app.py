# =============================================================================
# FILE: app.py — Secure Data Vault Backend (Full Improved Version)
# NEW: Rate limiting, edit notes, pin notes, export vault, tamper demo
# =============================================================================

import os, logging, logging.handlers
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import jwt
from dotenv import load_dotenv

from crypto_utils import (
    encrypt_note, decrypt_note, generate_rsa_keys,
    rsa_encrypt, sign_data, verify_signature
)
from auth_utils import hash_password, verify_password
from database import (
    init_db, create_user, get_user_by_username,
    save_note, get_notes_by_user, delete_note,
    update_note, toggle_pin_note
)

# ── Logging ───────────────────────────────────────────────────────────────────
load_dotenv()
log_handler = logging.handlers.RotatingFileHandler(
    "vault_errors.log", maxBytes=5*1024*1024, backupCount=3)
log_handler.setLevel(logging.ERROR)
log_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
logging.basicConfig(level=logging.ERROR, handlers=[log_handler])
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# SECURITY: Rate limiting — stops brute-force attacks
limiter = Limiter(
    get_remote_address, app=app,
    default_limits=["300 per day", "60 per hour"],
    storage_uri="memory://"
)

AES_KEY    = os.getenv("AES_KEY", "").encode("utf-8")
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-production")
if not AES_KEY:
    raise RuntimeError("AES_KEY not found in .env! Run generate_env_key.py first.")

RSA_PRIVATE_KEY, RSA_PUBLIC_KEY = generate_rsa_keys()
init_db()

# ── Error Handlers ────────────────────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_all(e):
    logger.error(f"Unhandled: {e}", exc_info=True)
    return jsonify({"error": "Unable to process request."}), 500

@app.errorhandler(404)
def not_found(e): return jsonify({"error": "Not found."}), 404

@app.errorhandler(429)
def rate_limited(e):
    return jsonify({"error": "Too many attempts. Please wait before trying again."}), 429

# ── Auth Decorator ────────────────────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401
        try:
            p = jwt.decode(auth.replace("Bearer ", ""), JWT_SECRET, algorithms=["HS256"])
            request.user_id  = p["user_id"]
            request.username = p["username"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401
        return f(*args, **kwargs)
    return decorated

# ── Status ────────────────────────────────────────────────────────────────────
@app.route("/api/status")
def status():
    return jsonify({
        "status": "Vault is online",
        "symmetric_encryption": "AES-256 (Fernet)",
        "asymmetric_encryption": "RSA-2048 (OAEP)",
        "digital_signatures":   "RSA-PSS with SHA-256",
        "password_hashing":     "bcrypt (rounds=12)",
        "sql_protection":       "Parameterized Queries",
        "rate_limiting":        "Active (5 login attempts/minute)",
        "tls":                  "See SETUP_GUIDE.md"
    }), 200

# ── Register ──────────────────────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
@limiter.limit("10 per minute")
def register():
    try:
        body = request.get_json()
        if not body: return jsonify({"error": "Request body required."}), 400
        username = str(body.get("username", "")).strip()
        password = str(body.get("password", ""))
        if not username or not password:
            return jsonify({"error": "Username and password required."}), 400
        if len(username) < 3 or len(username) > 30:
            return jsonify({"error": "Username must be 3–30 characters."}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters."}), 400
        if not username.isalnum():
            return jsonify({"error": "Username: letters and numbers only."}), 400
        if get_user_by_username(username):
            return jsonify({"error": "Username already taken."}), 409
        uid = create_user(username, hash_password(password))
        return jsonify({"message": "Account created. Please log in.",
                        "user_id": uid}), 201
    except Exception as e:
        logger.error(f"Register: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Login ─────────────────────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
@limiter.limit("5 per minute")   # SECURITY: prevents brute-force
def login():
    try:
        body = request.get_json()
        if not body: return jsonify({"error": "Request body required."}), 400
        username = str(body.get("username", "")).strip()
        password = str(body.get("password", ""))
        if not username or not password:
            return jsonify({"error": "Username and password required."}), 400
        user = get_user_by_username(username)
        if not user or not verify_password(password, user["password_hash"]):
            return jsonify({"error": "Invalid username or password."}), 401
        token = jwt.encode(
            {"user_id": user["id"], "username": user["username"],
             "exp": datetime.now(timezone.utc) + timedelta(hours=2)},
            JWT_SECRET, algorithm="HS256"
        )
        return jsonify({"token": token, "username": user["username"],
                        "message": "Login successful."}), 200
    except Exception as e:
        logger.error(f"Login: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Add Note ──────────────────────────────────────────────────────────────────
@app.route("/api/notes", methods=["POST"])
@token_required
@limiter.limit("30 per minute")
def add_note():
    try:
        body = request.get_json()
        note_text = str(body.get("note", "")).strip()
        if not note_text: return jsonify({"error": "Note cannot be empty."}), 400
        if len(note_text) > 5000:
            return jsonify({"error": "Note exceeds 5000 characters."}), 400
        encrypted = encrypt_note(note_text, AES_KEY)
        signature = sign_data(encrypted, RSA_PRIVATE_KEY)
        note_id   = save_note(request.user_id, encrypted, signature)
        return jsonify({
            "message": "Note encrypted and saved.",
            "note_id": note_id,
            "encrypted_preview": encrypted[:50] + "...",
            "signed": True
        }), 201
    except Exception as e:
        logger.error(f"Add note: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Get Notes ─────────────────────────────────────────────────────────────────
@app.route("/api/notes", methods=["GET"])
@token_required
def get_notes():
    try:
        raw = get_notes_by_user(request.user_id)
        result = []
        for note in raw:
            valid = verify_signature(note["encrypted_note"],
                                     note["signature"], RSA_PUBLIC_KEY)
            base = {
                "id":         note["id"],
                "created_at": note["created_at"],
                "updated_at": note.get("updated_at"),
                "pinned":     bool(note.get("pinned", 0)),
            }
            if valid:
                try:
                    plain = decrypt_note(note["encrypted_note"], AES_KEY)
                    result.append({**base, "content": plain,
                                   "integrity": "verified",
                                   "integrity_label": "Signature Verified"})
                except RuntimeError:
                    result.append({**base, "content": "[Decryption failed]",
                                   "integrity": "decrypt_failed",
                                   "integrity_label": "Decryption Failed"})
            else:
                result.append({**base,
                               "content": "[Blocked — integrity check failed]",
                               "integrity": "tampered",
                               "integrity_label": "Signature Invalid — Tampered"})
        return jsonify({"notes": result, "count": len(result)}), 200
    except Exception as e:
        logger.error(f"Get notes: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Edit Note ─────────────────────────────────────────────────────────────────
@app.route("/api/notes/<int:note_id>", methods=["PUT"])
@token_required
def edit_note(note_id):
    try:
        body = request.get_json()
        note_text = str(body.get("note", "")).strip()
        if not note_text: return jsonify({"error": "Note cannot be empty."}), 400
        if len(note_text) > 5000:
            return jsonify({"error": "Note exceeds 5000 characters."}), 400
        encrypted = encrypt_note(note_text, AES_KEY)
        signature = sign_data(encrypted, RSA_PRIVATE_KEY)
        ok = update_note(note_id, request.user_id, encrypted, signature)
        if not ok: return jsonify({"error": "Note not found or access denied."}), 404
        return jsonify({"message": "Note updated and re-encrypted."}), 200
    except Exception as e:
        logger.error(f"Edit note: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Delete Note ───────────────────────────────────────────────────────────────
@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
@token_required
def remove_note(note_id):
    try:
        ok = delete_note(note_id, request.user_id)
        if ok: return jsonify({"message": "Note deleted."}), 200
        return jsonify({"error": "Note not found or access denied."}), 404
    except Exception as e:
        logger.error(f"Delete: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Pin / Unpin ───────────────────────────────────────────────────────────────
@app.route("/api/notes/<int:note_id>/pin", methods=["PATCH"])
@token_required
def pin_note(note_id):
    try:
        result = toggle_pin_note(note_id, request.user_id)
        if result is None: return jsonify({"error": "Note not found."}), 404
        return jsonify({"message": "Pin toggled.", "pinned": result}), 200
    except Exception as e:
        logger.error(f"Pin: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Export Vault ──────────────────────────────────────────────────────────────
@app.route("/api/export", methods=["GET"])
@token_required
def export_vault():
    try:
        raw = get_notes_by_user(request.user_id)
        export = []
        for note in raw:
            valid = verify_signature(note["encrypted_note"],
                                     note["signature"], RSA_PUBLIC_KEY)
            if valid:
                try:
                    plain = decrypt_note(note["encrypted_note"], AES_KEY)
                    export.append({"id": note["id"], "content": plain,
                                   "pinned": bool(note.get("pinned", 0)),
                                   "created_at": note["created_at"],
                                   "updated_at": note.get("updated_at"),
                                   "integrity": "verified"})
                except RuntimeError:
                    export.append({"id": note["id"],
                                   "content": "[Decryption failed]",
                                   "integrity": "error"})
            else:
                export.append({"id": note["id"],
                               "content": "[Tampered — blocked]",
                               "integrity": "tampered"})
        return jsonify({
            "export_time": datetime.now(timezone.utc).isoformat(),
            "username": request.username,
            "total_notes": len(export),
            "notes": export
        }), 200
    except Exception as e:
        logger.error(f"Export: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Tamper Demo ───────────────────────────────────────────────────────────────
@app.route("/api/demo/tamper/<int:note_id>", methods=["POST"])
@token_required
def tamper_demo(note_id):
    """DEMO: Corrupts a note so the RSA signature check fails — for teaching."""
    from database import get_connection
    try:
        conn = get_connection()
        c = conn.cursor()
        c.execute("SELECT id FROM notes WHERE id = ? AND user_id = ?",
                  (note_id, request.user_id))
        if not c.fetchone():
            conn.close()
            return jsonify({"error": "Note not found."}), 404
        c.execute(
            "UPDATE notes SET encrypted_note = ? WHERE id = ? AND user_id = ?",
            (f"TAMPERED_DEMO_DATA_{note_id}", note_id, request.user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({
            "message": "Note tampered! Refresh vault to see the ⚠️ signature failure.",
            "demo": True
        }), 200
    except Exception as e:
        logger.error(f"Tamper demo: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── RSA Demo ──────────────────────────────────────────────────────────────────
@app.route("/api/demo/rsa-encrypt", methods=["POST"])
@token_required
def demo_rsa_encrypt():
    try:
        body = request.get_json()
        message = str(body.get("message", "")).strip()
        if not message or len(message) > 200:
            return jsonify({"error": "Message must be 1–200 characters."}), 400
        encrypted_b64 = rsa_encrypt(message.encode("utf-8"), RSA_PUBLIC_KEY)
        return jsonify({
            "original": message,
            "encrypted_rsa": encrypted_b64,
            "note": "Encrypted with RSA-2048. Only the server private key can decrypt."
        }), 200
    except Exception as e:
        logger.error(f"RSA demo: {e}", exc_info=True)
        return jsonify({"error": "Unable to process request."}), 500

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🔒 Secure Data Vault — Enhanced Edition")
    print("   AES-256 / RSA-2048 / bcrypt / Rate Limiting — All Ready")
    print("   http://localhost:5000")
    app.run(debug=False, host="0.0.0.0", port=5000)
