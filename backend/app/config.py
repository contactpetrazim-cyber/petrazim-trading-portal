
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

    # Autonomous market scanner (market_scanner.py) — the loop that lets
    # bots read the market themselves instead of waiting on a
    # TradingView Pine alert. Off by default: it makes real API calls
    # to real exchanges every cycle even in "paper" mode, so it's an
    # opt-in once you're ready to test it, not a silent default.
    MARKET_SCANNER_ENABLED: bool = False
    MARKET_SCANNER_INTERVAL_SECONDS: int = 300
    MARKET_SCANNER_DEFAULT_EXCHANGE: str = "binance"
    # Used only for position-sizing math when a bot has no live broker
    # balance to read (paper mode, or no credential configured yet).
    MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE: float = 10000.0

    # Per-bot broker credentials (models/broker_credential.py) are
    # encrypted at rest with this key rather than the JWT SECRET_KEY,
    # so rotating one doesn't affect the other. Generate with:
    #   python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    CREDENTIALS_ENCRYPTION_KEY: str = ""

    class Config:
        env_file = ".env"
        # Several services (payments.py, telegram.py, fireflies.py, the
        # Google Calendar connector, ...) read their own env vars
        # directly via os.environ rather than through this Settings
        # class — deliberately, so their existence isn't tied to a
        # Settings field for every third-party key. Without this,
        # pydantic-settings raises "Extra inputs are not permitted" for
        # every one of those and the app fails to even start the moment
        # a real deploy sets the full env var list from
        # docs/MERGE_AND_DEPLOY_GUIDE.md — most of which aren't (and
        # shouldn't need to be) declared as fields here.
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
