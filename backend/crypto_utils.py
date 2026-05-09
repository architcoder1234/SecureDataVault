# =============================================================================
# FILE: crypto_utils.py
# PURPOSE: All cryptographic operations — AES-256, RSA, Digital Signatures
# LIBRARY: cryptography (pip install cryptography)
# =============================================================================

import base64
import logging
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

logger = logging.getLogger(__name__)


# =============================================================================
# SECTION 1: SYMMETRIC ENCRYPTION — AES-256 via Fernet
# WHY: AES-256 is extremely fast. Perfect for encrypting large data like notes.
# HOW: The SAME secret key locks AND unlocks the data ("symmetric").
# =============================================================================

def generate_aes_key() -> bytes:
    """
    Generates a new AES-256 key.
    Store this in your .env file — NEVER hardcode it in source code.
    """
    return Fernet.generate_key()


def encrypt_note(plain_text: str, aes_key: bytes) -> str:
    """
    Encrypts a plain-text string using AES-256.

    Steps:
      1. Create a Fernet cipher object using the secret key.
      2. Convert the plain text to bytes.
      3. Encrypt it — Fernet handles IV/nonce automatically for safety.
      4. Return the encrypted bytes as a UTF-8 string for DB storage.

    Args:
        plain_text: The note the user wants to secure.
        aes_key: The AES-256 key loaded from the .env file.

    Returns:
        An encrypted string safe to store in the database.
    """
    try:
        cipher = Fernet(aes_key)
        encrypted_bytes = cipher.encrypt(plain_text.encode("utf-8"))
        return encrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"AES encryption failed: {e}")
        raise RuntimeError("Encryption failed.")


def decrypt_note(encrypted_text: str, aes_key: bytes) -> str:
    """
    Decrypts an AES-256 encrypted string back to plain text.

    SECURITY NOTE: We catch InvalidToken separately. This specific error
    means the data was tampered with OR the key is wrong. We log the
    technical detail but only show a generic message to the user.

    Args:
        encrypted_text: The encrypted string from the database.
        aes_key: The same AES-256 key used for encryption.

    Returns:
        The original plain-text note.
    """
    try:
        cipher = Fernet(aes_key)
        decrypted_bytes = cipher.decrypt(encrypted_text.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except InvalidToken:
        # OWASP: Log technical detail to file, NOT to the user response
        logger.error("AES decryption failed: InvalidToken — key mismatch or tampered data.")
        raise RuntimeError("Unable to process request.")
    except Exception as e:
        logger.error(f"AES decryption unexpected error: {e}")
        raise RuntimeError("Unable to process request.")


# =============================================================================
# SECTION 2: ASYMMETRIC ENCRYPTION — RSA-2048
# WHY: RSA uses a KEY PAIR. Public key encrypts, Private key decrypts.
#      Great for securely sharing the AES key itself with another party.
# HOW: Only the owner of the private key can read the encrypted message.
# =============================================================================

def generate_rsa_keys():
    """
    Generates an RSA-2048 key pair at application startup.

    Returns:
        A tuple of (private_key, public_key) objects.
        - Private key: Keep SECRET on the server. Used to decrypt & sign.
        - Public key: Share openly. Used to encrypt & verify signatures.
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,  # Standard safe value
        key_size=2048           # 2048-bit = strong security
    )
    public_key = private_key.public_key()
    return private_key, public_key


def rsa_encrypt(data: bytes, public_key) -> str:
    """
    Encrypts small data (like an AES key) using the RSA Public Key.

    WHY OAEP PADDING?
      - OAEP (Optimal Asymmetric Encryption Padding) adds randomness.
      - Without it, the same input always gives the same output — insecure.
      - SHA-256 is used as the hash function inside OAEP.

    Args:
        data: The bytes to encrypt (e.g., the AES key bytes).
        public_key: The RSA public key object.

    Returns:
        Base64-encoded encrypted string for easy storage/transport.
    """
    try:
        encrypted = public_key.encrypt(
            data,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return base64.b64encode(encrypted).decode("utf-8")
    except Exception as e:
        logger.error(f"RSA encryption failed: {e}")
        raise RuntimeError("Unable to process request.")


def rsa_decrypt(encrypted_b64: str, private_key) -> bytes:
    """
    Decrypts RSA-encrypted data using the Private Key.

    Args:
        encrypted_b64: Base64-encoded encrypted string.
        private_key: The RSA private key object (kept secret on server).

    Returns:
        The original bytes (e.g., the AES key).
    """
    try:
        encrypted = base64.b64decode(encrypted_b64)
        decrypted = private_key.decrypt(
            encrypted,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        return decrypted
    except Exception as e:
        logger.error(f"RSA decryption failed: {e}")
        raise RuntimeError("Unable to process request.")


# =============================================================================
# SECTION 3: DIGITAL SIGNATURES
# WHY: A signature proves two things:
#   1. AUTHENTICITY — this note was created by the real server (not a faker).
#   2. INTEGRITY — the note has NOT been modified since it was signed.
# HOW: Sign with Private Key → Verify with Public Key.
#   If even ONE character changes, verification FAILS.
# =============================================================================

def sign_data(data: str, private_key) -> str:
    """
    Creates a digital signature for a piece of data.

    WHY PSS PADDING?
      - PSS (Probabilistic Signature Scheme) is the modern, secure padding
        for RSA signatures. It adds randomness for stronger security.

    Args:
        data: The string to sign (we sign the encrypted note text).
        private_key: RSA private key. Only the server can create valid signatures.

    Returns:
        Base64-encoded signature string, stored alongside the note in DB.
    """
    try:
        signature = private_key.sign(
            data.encode("utf-8"),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return base64.b64encode(signature).decode("utf-8")
    except Exception as e:
        logger.error(f"Digital signing failed: {e}")
        raise RuntimeError("Unable to process request.")


def verify_signature(data: str, signature_b64: str, public_key) -> bool:
    """
    Verifies a digital signature to confirm data integrity.

    This is called BEFORE decrypting any note. If verification fails,
    the note was tampered with in the database — we refuse to show it.

    Args:
        data: The data that was originally signed.
        signature_b64: The Base64-encoded signature stored in DB.
        public_key: RSA public key (can be shared openly).

    Returns:
        True if the data is untampered. False if it was modified.
    """
    try:
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            data.encode("utf-8"),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return True  # Signature is valid — data is intact
    except Exception:
        # Any exception here means verification FAILED
        logger.warning("Signature verification failed — data may be tampered.")
        return False
