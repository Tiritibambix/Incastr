from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str
    database_url: str = "sqlite+aiosqlite:////data/incastr.db"
    thumbs_dir: str = "/data/thumbs"
    access_token_expire_minutes: int = 60
    allow_registration: bool = True
    max_scan_depth: int = 10
    scan_interval_minutes: int = 60
    first_admin_username: str | None = None
    first_admin_password: str | None = None
    first_admin_email: str | None = None

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
