import json
from typing import List, Union

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    BACKEND_CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000"]

    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres_secure_pass"
    POSTGRES_DB: str = "airspace"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"

    DATABASE_URL: str | None = None

    def get_db_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            try:
                # Attempt to parse JSON list (e.g. '["http://localhost:3000"]')
                return json.loads(self.BACKEND_CORS_ORIGINS)
            except json.JSONDecodeError:
                # If it's a comma-separated string
                return [
                    origin.strip()
                    for origin in self.BACKEND_CORS_ORIGINS.split(",")
                    if origin.strip()
                ]
        return self.BACKEND_CORS_ORIGINS

    model_config = ConfigDict(
        case_sensitive=True, env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
