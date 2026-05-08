from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent  # /.../Agency_Match-AI/backend
REPO_ROOT = BACKEND_DIR.parent                        # /.../Agency_Match-AI


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    database_url: str = "sqlite:///./data/agencies.db"
    llm_model: str = "claude-sonnet-4-6"
    scoring_concurrency: int = 10

    # Load repo-root .env first, then optional backend/.env override.
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
