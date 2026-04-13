from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "CaisseFlow Pro - Report Service"
    app_port: int = 8001
    debug: bool = False

    # Database (SQL Server)
    db_host: str = "localhost"
    db_port: int = 1433
    db_user: str = "sa"
    db_password: str = "Toi&MoiSaFait1"
    db_name: str = "caisseflow"
    db_driver: str = "ODBC+Driver+17+for+SQL+Server"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # JWT
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_public_key: str = ""
    jwt_algorithm: str = "HS256"

    # Storage
    reports_storage_path: str = "/tmp/reports"

    # Company defaults (configurable per tenant)
    company_name: str = "CaisseFlow Pro"
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    company_logo_url: str = ""
    company_rccm: str = ""
    company_cc: str = ""

    # Services URLs (for cross-service data fetching)
    expense_service_url: str = "http://localhost:3003/api/v1"
    sales_service_url: str = "http://localhost:3004/api/v1"
    auth_service_url: str = "http://localhost:3001/api/v1"

    # Currency
    currency: str = "XOF"
    tva_rate: float = 0.18

    @property
    def database_url(self) -> str:
        from urllib.parse import quote_plus
        pwd = quote_plus(self.db_password)
        return (
            f"mssql+pyodbc://{self.db_user}:{pwd}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?driver={self.db_driver}&TrustServerCertificate=yes"
        )

    @property
    def async_database_url(self) -> str:
        from urllib.parse import quote_plus
        pwd = quote_plus(self.db_password)
        return (
            f"mssql+aioodbc://{self.db_user}:{pwd}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?driver={self.db_driver}&TrustServerCertificate=yes"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    model_config = {"env_prefix": "", "env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
