# =============================================================================
# FILE: auth_utils.py
# PURPOSE: Secure password hashing using bcrypt (OWASP Standard)
# LIBRARY: bcrypt (pip install bcrypt)
# =============================================================================

# WHY BCRYPT INSTEAD OF MD5/SHA256?
# ----------------------------------
# MD5/SHA256 are designed to be FAST — bad for passwords (hackers can try
# billions of guesses per second). bcrypt is intentionally SLOW and includes
# a "work factor" (cost). Higher cost = slower hashing = harder to brute-force.
#
# KEY CONCEPTS:
#   SALT: bcrypt automatically adds a random string to the password before
#         hashing. This means two users with the same password get DIFFERENT
#         hashes. Prevents "rainbow table" attacks.
#   ONE-WAY: You CANNOT reverse a hash back to the password. This is different
#            from encryption (which is reversible). If the DB is stolen, the
#            attacker still can't get the real passwords.

import bcrypt
import logging

logger = logging.getLogger(__name__)


def hash_password(plain_password: str) -> str:
    """
    Hashes a plain-text password using bcrypt with automatic salting.

    SECURITY CHOICES:
      - rounds=12: The "work factor". 2^12 = 4096 iterations of hashing.
        Takes ~250ms on a modern CPU. Fast enough for login, slow for hackers.
        NEVER use rounds < 10 in production.

    Args:
        plain_password: The raw password the user typed during signup.

    Returns:
        A bcrypt hash string (60 characters) safe to store in the database.
        Example: "$2b$12$rEPGY3sdkH1lIL1KIJ.n4.abc123..."
    """
    try:
        # Encode string to bytes, generate salt + hash in one step
        password_bytes = plain_password.encode("utf-8")
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode("utf-8")
    except Exception as e:
        logger.error(f"Password hashing failed: {e}")
        raise RuntimeError("Unable to process request.")


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Safely checks if a plain-text password matches the stored bcrypt hash.

    WHY USE checkpw() AND NOT PLAIN COMPARISON?
      - bcrypt.checkpw() extracts the salt from the stored hash automatically.
      - It re-hashes the input with that SAME salt and compares.
      - This is a constant-time comparison, preventing timing attacks.
      - NEVER do: hash_password(input) == stored_hash (this is WRONG).

    Args:
        plain_password: Password from the login form.
        stored_hash: The bcrypt hash retrieved from the database.

    Returns:
        True if the password is correct. False otherwise.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            stored_hash.encode("utf-8")
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False  # Fail safely — never crash on auth checks
