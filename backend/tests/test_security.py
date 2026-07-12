import time

import pytest

from app.core.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    generate_opaque_token,
    generate_otp_code,
    hash_secret,
)


def test_access_token_round_trip() -> None:
    token = create_access_token("user_123", workspace_id="ws_456", role="admin")
    claims = decode_access_token(token)

    assert claims.sub == "user_123"
    assert claims.workspace_id == "ws_456"
    assert claims.role == "admin"
    assert claims.exp > claims.iat


def test_access_token_without_workspace_context() -> None:
    token = create_access_token("user_123")
    claims = decode_access_token(token)

    assert claims.workspace_id is None
    assert claims.role is None


def test_decode_rejects_garbage_token() -> None:
    with pytest.raises(InvalidTokenError):
        decode_access_token("not.a.valid.jwt")


def test_decode_rejects_tampered_signature() -> None:
    token = create_access_token("user_123")
    tampered = token[:-2] + ("aa" if token[-2:] != "aa" else "bb")
    with pytest.raises(InvalidTokenError):
        decode_access_token(tampered)


def test_generate_otp_code_is_six_digits() -> None:
    for _ in range(20):
        code = generate_otp_code()
        assert len(code) == 6
        assert code.isdigit()


def test_hash_secret_is_deterministic_and_one_way() -> None:
    value = generate_opaque_token()
    assert hash_secret(value) == hash_secret(value)
    assert hash_secret(value) != value


def test_generate_opaque_token_is_high_entropy_and_unique() -> None:
    tokens = {generate_opaque_token() for _ in range(50)}
    assert len(tokens) == 50


def test_access_token_exp_matches_configured_ttl() -> None:
    before = int(time.time())
    token = create_access_token("user_123")
    claims = decode_access_token(token)
    # 15 minute default TTL (app/core/config.py) - allow a couple seconds of test jitter.
    assert 14 * 60 < (claims.exp - before) <= 15 * 60 + 2
