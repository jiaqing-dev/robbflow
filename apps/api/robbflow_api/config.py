from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://robbflow:robbflow@localhost:15432/robbflow"
    redis_url: str = "redis://localhost:16379/0"
    jwt_secret: str = "robbflow-dev-secret-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7
    seed: bool = True
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"


settings = Settings()
