from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "backline_local"
    redis_url: str = "redis://localhost:6379"

    r2_account_id: str = "local"
    r2_access_key_id: str = "backline-local"
    r2_secret_access_key: str = "backline-local-secret"
    r2_bucket_name: str = "backline-local"
    r2_endpoint_url: str = "http://localhost:9000"

    jwt_signing_key: str = "dev-only-change-me"
    jwt_access_ttl_minutes: int = 15
    jwt_refresh_ttl_days: int = 30

    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:5173/auth/callback"

    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5

    resend_api_key: str = ""
    resend_from_address: str = "Backline <onboarding@backline.app>"

    clickup_oauth_client_id: str = ""
    clickup_oauth_client_secret: str = ""
    trello_api_key: str = ""

    cors_allow_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
