# ======================================================================
# SETUP_GUIDE.md — Secure Data Vault: Full Setup on CachyOS / Linux
# ======================================================================

## PROJECT FILE STRUCTURE

```
secure-vault/
├── backend/
│   ├── app.py                  ← Flask main app (routes, JWT, error handler)
│   ├── crypto_utils.py         ← AES-256, RSA, Digital Signatures
│   ├── auth_utils.py           ← bcrypt password hashing
│   ├── database.py             ← SQLite + parameterized queries
│   ├── generate_env_key.py     ← One-time key generator
│   ├── requirements.txt        ← Python dependencies
│   ├── .env                    ← SECRET KEYS (auto-generated, never commit)
│   ├── vault.db                ← SQLite database (auto-created on first run)
│   └── vault_errors.log        ← Error log file (auto-created)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx             ← Root component (auth state + routing)
│   │   ├── App.css             ← Full stylesheet
│   │   └── components/
│   │       ├── AuthForm.jsx    ← Login / Register form
│   │       ├── VaultDashboard.jsx ← Add notes + RSA demo
│   │       ├── NotesList.jsx   ← Display decrypted notes with integrity
│   │       └── TrustStatus.jsx ← SSL/security indicator banner
│   └── package.json
│
└── SETUP_GUIDE.md              ← This file
```

---

## PHASE 1 — BACKEND SETUP

### Step 1.1 — Install Python (if needed)

CachyOS (Arch-based) — Python 3 is usually pre-installed. Verify:

```bash
python --version
# Should show Python 3.10 or newer
```

### Step 1.2 — Create a Virtual Environment

A virtual environment keeps your project's packages separate from the system.

```bash
cd secure-vault/backend

# Create the venv
python -m venv venv

# Activate it (do this EVERY TIME before running the backend)
source venv/bin/activate

# You should see (venv) in your terminal prompt
```

### Step 1.3 — Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `flask` — web framework
- `flask-cors` — allows React to talk to Flask
- `cryptography` — AES-256 + RSA + signatures
- `bcrypt` — password hashing
- `PyJWT` — JSON Web Tokens
- `python-dotenv` — .env file loader

### Step 1.4 — Generate Your Secret Keys (IMPORTANT — run only once)

```bash
python generate_env_key.py
```

This creates a `.env` file with:
- `AES_KEY` — your AES-256 encryption key
- `JWT_SECRET` — secret for signing login tokens

⚠️  **NEVER commit .env to Git!**

Add it to .gitignore immediately:
```bash
echo ".env" >> ../.gitignore
echo "vault.db" >> ../.gitignore
echo "vault_errors.log" >> ../.gitignore
echo "venv/" >> ../.gitignore
```

### Step 1.5 — Run the Flask Backend

```bash
python app.py
```

You should see:
```
🔒 Secure Data Vault Backend Starting...
   AES-256  : Ready
   RSA-2048 : Ready
   bcrypt   : Ready
   SQLite   : Ready
   Running on http://localhost:5000
```

Test it:
```bash
curl http://localhost:5000/api/status
```

Expected response:
```json
{
  "status": "🔒 Vault is online",
  "symmetric_encryption": "AES-256 (Fernet)",
  ...
}
```

---

## PHASE 2 — FRONTEND SETUP

### Step 2.1 — Install Node.js

```bash
# On CachyOS (Arch-based)
sudo pacman -S nodejs npm

# Verify
node --version    # Should be 18+
npm --version
```

### Step 2.2 — Create the React App

```bash
cd secure-vault/frontend

# Using Vite (faster than Create React App)
npm create vite@latest . -- --template react

# When prompted, choose "React" and "JavaScript"
```

### Step 2.3 — Install Frontend Dependencies

```bash
npm install
```

### Step 2.4 — Copy the Source Files

The files in `frontend/src/` (App.jsx, App.css, components/) 
are your custom code. Place them in the Vite project's `src/` folder.

If you used Vite, delete the default placeholder files first:
```bash
rm src/App.jsx src/App.css src/index.css src/assets/react.svg
```
Then copy in the project files.

### Step 2.5 — Run the React Dev Server

```bash
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## PHASE 3 — SSL/TLS SETUP (Data in Transit)

SSL/TLS encrypts data between the browser and your Flask backend
so no one can intercept notes being sent over the network.

### Step 3.1 — Generate a Self-Signed Certificate with OpenSSL

```bash
cd secure-vault/backend

# Generate private key + self-signed certificate in one command
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/C=IN/ST=UP/L=Prayagraj/O=SecureVault/CN=localhost"
```

This creates:
- `cert.pem` — the certificate (acts as your "ID card")
- `key.pem` — the private key (keep SECRET, like the bcrypt keys)

### Step 3.2 — Enable HTTPS in Flask

Change the last line of `app.py` from:
```python
app.run(debug=False, host="0.0.0.0", port=5000)
```

To:
```python
app.run(
    debug=False,
    host="0.0.0.0",
    port=5000,
    ssl_context=("cert.pem", "key.pem")  # ← Add this line
)
```

Now the backend runs on: **https://localhost:5000**

### Step 3.3 — Update the React API URL

In these frontend files, change:
```
http://localhost:5000/api
```
to:
```
https://localhost:5000/api
```

Files to update:
- `src/components/AuthForm.jsx` (top of file, `const API = ...`)
- `src/components/VaultDashboard.jsx` (top of file, `const API = ...`)
- `src/components/TrustStatus.jsx` (top of file, `const API = ...`)

### Step 3.4 — Accept the Self-Signed Certificate

Since it's not from a real Certificate Authority (CA), browsers will
warn you. For development:

1. Visit `https://localhost:5000/api/status` directly in your browser
2. Click "Advanced" → "Accept the risk and continue"
3. Now your React app can communicate over HTTPS

### Why This Matters (for your report)

| Layer | What's Protected | How |
|-------|-----------------|-----|
| Data at Rest | Notes in database | AES-256 encryption |
| Data in Transit | Network traffic | SSL/TLS (HTTPS) |
| Authentication | Passwords | bcrypt hashing |
| Integrity | Note content | RSA digital signatures |
| Input Safety | SQL injection | Parameterized queries |
| Error Safety | Stack trace leaks | Global error handler + log file |

---

## PHASE 4 — TESTING YOUR SECURITY FEATURES

### Test 1: Register and Login
1. Open http://localhost:5173
2. Register with username: `testuser`, password: `securePass123`
3. Check `vault.db` — you should see a hashed password, NOT the plain text

```bash
sqlite3 vault.db "SELECT username, password_hash FROM users;"
# username: testuser
# password_hash: $2b$12$... (bcrypt hash — unreadable)
```

### Test 2: Encrypt a Note
1. After login, type a note and click "Encrypt & Save Note"
2. Check the database — you should see ciphertext, NOT your text

```bash
sqlite3 vault.db "SELECT encrypted_note FROM notes LIMIT 1;"
# Output: gAAAAABl... (AES-256 Fernet ciphertext)
```

### Test 3: Signature Verification
1. Save a note normally — it shows "✅ Signature Verified"
2. Manually corrupt the note in the database:
```bash
sqlite3 vault.db "UPDATE notes SET encrypted_note='corrupted' WHERE id=1;"
```
3. Refresh the vault — the note should show "⚠️ Signature Invalid"

### Test 4: SQL Injection Prevention
Try entering this as your username during registration:
```
admin' OR '1'='1
```
The app should reject it at the validation layer (alphanumeric only).
Even if it reached the database, the parameterized query would treat it
as a literal string — not as SQL code.

---

## QUICK REFERENCE — OWASP MAPPING

| OWASP Top 10 Risk | Where Fixed in This Project |
|-------------------|----------------------------|
| A01: Broken Access Control | JWT auth on all /api/notes routes; user_id from token not user input |
| A02: Cryptographic Failures | AES-256 for data at rest; bcrypt for passwords; no hardcoded keys |
| A03: Injection (SQLi) | Parameterized queries in ALL database.py functions |
| A04: Insecure Design | Signature verification BEFORE decryption |
| A05: Security Misconfiguration | CORS restricted to localhost:3000 only |
| A07: Identification & Auth | bcrypt hashing; same error for wrong user/wrong password |
| A09: Logging Failures | RotatingFileHandler logs errors to file with traceback |

---

## COMMON ERRORS & FIXES

| Error | Fix |
|-------|-----|
| `AES_KEY not found in .env` | Run `python generate_env_key.py` first |
| `CORS error in browser` | Make sure Flask is running AND .env is loaded |
| `Module not found` | Run `source venv/bin/activate` then `pip install -r requirements.txt` |
| `SSL certificate warning` | Visit https://localhost:5000/api/status and accept the cert |
| `Cannot connect to vault server` | Start Flask backend first: `python app.py` |

---

*Built for Mini Project 2: Cryptography and Secure Coding Practices*
*Stack: Python 3 + Flask + SQLite + React (Vite) + cryptography + bcrypt*
