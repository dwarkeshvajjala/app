from cryptography.fernet import Fernet

from app.core.config import get_settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_settings().integrations_encryption_key.encode())
    return _fernet


def encrypt_secret(value: str) -> str:
    """Application-layer encryption for values that must be recoverable (unlike
    hash_secret's one-way hashing) - OAuth tokens (17-Notifications-Integrations.md
    §17.3's `oauth_token_encrypted`), which the integration needs back in plaintext to
    call the third-party API. Never store `value` itself in Mongo, only this."""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_secret(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()
