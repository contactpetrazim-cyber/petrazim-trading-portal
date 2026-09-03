
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    APP_NAME: str = "SMC Trading Engine"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://smc:smc_secret@db:5432/smc_trading"
    SYNC_DATABASE_URL: str = "postgresql://smc:smc_secret@db:5432/smc_trading"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Security
    SECRET_KEY: str = "smc-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Trading Defaults
    DEFAULT_RISK_PERCENT: float = 1.0
    DEFAULT_RR_RATIO: float = 3.0
    MAX_DAILY_TRADES: int = 10
    MAX_PORTFOLIO_EXPOSURE: float = 5.0

    # Webhook
    WEBHOOK_SECRET: str = "tv-webhook-secret"

    # Broker API Keys
    # Binance
    BINANCE_API_KEY: str = ""
    BINANCE_SECRET: str = ""

    # Bybit
    BYBIT_API_KEY: str = ""
    BYBIT_SECRET: str = ""

    # BingX (Crypto)
    BINGX_API_KEY: str = ""
    BINGX_SECRET: str = ""

    # TradeLocker (Forex/Prop Firm)
    TRADELOCKER_API_KEY: str = ""
    TRADELOCKER_SECRET: str = ""
    TRADELOCKER_ACCOUNT_ID: str = ""

    # MEXC (Crypto futures)
    MEXC_API_KEY: str = ""
    MEXC_SECRET: str = ""

    # Cross-exchange price sanity guard — see broker_integrations.py /
    # execution_engine.py docstrings. A signal's entry price (often
    # computed against whichever exchange fed the bot's candles) is
    # checked against a live ticker pulled from the ACTUAL execution
    # broker immediately before an order fires; if they disagree by
    # more than this percentage, the trade is flagged instead of sent.
    PRICE_DEVIATION_TOLERANCE_PCT: float = 0.25

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
