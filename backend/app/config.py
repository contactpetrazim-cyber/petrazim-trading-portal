
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

    # "Continue with Google" login (routers/auth.py POST /auth/google).
    # This is the OAuth 2.0 Client ID from Google Cloud Console ->
    # APIs & Services -> Credentials -> "OAuth client ID" (Web
    # application type) — NOT a client secret, since the frontend uses
    # Google Identity Services' button flow (a signed ID token posted
    # here for server-side verification), which needs no secret or
    # redirect URI, only this ID and the site's origin added under
    # "Authorized JavaScript origins". Empty by default: the endpoint
    # returns 503 (not a crash) until this is set, so the frontend can
    # detect "not configured yet" and hide the button rather than
    # showing one that 500s.
    GOOGLE_CLIENT_ID: str = ""

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

    # MT4/MT5 via MetaApi.cloud (broker_integrations.py::MetaApiBroker) —
    # METAAPI_ACCOUNT_ID/METAAPI_REGION come from MetaApi's own dashboard
    # after you've connected your real MT4/5 login there; neither MT4
    # nor MT5 has a public API of its own, MetaApi is the standard bridge.
    METAAPI_TOKEN: str = ""
    METAAPI_ACCOUNT_ID: str = ""
    METAAPI_REGION: str = "new-york"

    # Fixie static-IP proxies — most exchanges require whitelisting a
    # fixed IP for a trading-enabled API key, which a free PaaS host's
    # own (dynamic) egress IP can't satisfy. Each exchange's private
    # (signed) calls route through its own proxy below when set; public
    # market-data calls (data_ingestion.py's candle fetching) are
    # unaffected — they don't need whitelisting and would blow through
    # Fixie's small monthly quota if they were routed through it too.
    # Format: http://fixie:<password>@<host>.usefixie.com:80
    #
    # Each exchange also gets a *_BACKUP_PROXY_URL — since all 4 Fixie
    # IPs (both the ventoux and criterium pools) are whitelisted on
    # every exchange, a request can fail over to the backup pool
    # automatically (see broker_integrations.py's _send_with_failover)
    # if the primary one has an outage, rather than that exchange's
    # trading simply stopping.
    BYBIT_PROXY_URL: str = ""
    BYBIT_BACKUP_PROXY_URL: str = ""
    BINGX_PROXY_URL: str = ""
    BINGX_BACKUP_PROXY_URL: str = ""
    BINANCE_PROXY_URL: str = ""
    BINANCE_BACKUP_PROXY_URL: str = ""
    MEXC_PROXY_URL: str = ""
    MEXC_BACKUP_PROXY_URL: str = ""
    MT5_PROXY_URL: str = ""

    # The literal outbound IP(s) a TRADER needs to whitelist on their
    # own exchange account to connect it to this platform (see
    # services/trader_broker_connections.py's own "Connect Your
    # Exchange" onboarding flow) — comma-separated if there's more than
    # one (e.g. the Fixie ventoux + criterium pools' real IPs, the same
    # two pools already whitelisted on every one of this platform's OWN
    # exchange keys above). Deliberately not hardcoded here: a Fixie (or
    # any proxy provider) IP is assigned per-account and this app has no
    # way to verify it hasn't changed — set this once you have the real,
    # current value(s) so the onboarding page shows a real IP instead of
    # a placeholder telling the trader to ask their admin.
    PLATFORM_OUTBOUND_IPS: str = ""

    # Auto-detection engine for the value above (services/
    # outbound_ip_detector.py) — by direct follow-up request ("can we
    # work an engine that auto do this" instead of hand-typing
    # PLATFORM_OUTBOUND_IPS). On by default: the probe is a handful of
    # free, no-auth IP-echo calls, not an exchange API call, so it
    # costs nothing to leave running. Long interval since Fixie's
    # assigned IPs essentially never change — this is a slow safety
    # net, not a polling loop.
    OUTBOUND_IP_DETECTOR_ENABLED: bool = True
    OUTBOUND_IP_DETECTOR_INTERVAL_SECONDS: int = 21600  # 6 hours

    # Backend-to-backend order-execution failover — by direct request
    # ("can orders... be broadcast using both fixie and VM IP... so
    # exchanges still get the instructions from my VM IP"). NOT a
    # broadcast (see routers/internal.py's own docstring on why
    # sending one real order down two independent paths at once is a
    # real duplicate-fill risk, not just inelegant) — a genuine
    # failover: Render only calls the VM after its OWN attempt has
    # already failed at the transport level (a broken Fixie proxy),
    # so at most one backend ever actually sends the order. Both left
    # blank by default — the relay path is fully inert (a 404, see
    # routers/internal.py) until BOTH are set on BOTH backends, so
    # this ships safe with zero behavior change for anyone who hasn't
    # opted in yet.
    #   VM_API_URL — the OTHER backend's own base URL (Render sets
    #   this to the VM's address; the VM sets it to Render's, so
    #   either direction could in principle relay to the other,
    #   though Render->VM is the only one that actually matters today
    #   since Render is where Fixie is failing).
    #   INTERNAL_RELAY_SECRET — a shared secret (generate your own
    #   random string, set the SAME value on both backends) checked
    #   via the X-Internal-Secret header — this is backend-to-backend
    #   auth, deliberately separate from the normal user JWT scheme.
    VM_API_URL: str = ""
    INTERNAL_RELAY_SECRET: str = ""

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
    # 3 minutes — by direct request after weighing "every 1 minute,
    # 1000 candles" against the default 5 min/200 candles: 200 candles
    # already covers as much history as the current strategies use, so
    # only the interval was worth tightening (faster reaction on the
    # 15M/1H timeframes) without the ~25x extra Binance API load 1
    # min/1000 candles would have cost for no real benefit.
    MARKET_SCANNER_INTERVAL_SECONDS: int = 180
    MARKET_SCANNER_DEFAULT_EXCHANGE: str = "binance"
    # Used only for position-sizing math when a bot has no live broker
    # balance to read (paper mode, or no credential configured yet).
    MARKET_SCANNER_DEFAULT_ACCOUNT_BALANCE: float = 10000.0

    # Position monitor (services/position_monitor.py) — the real fix
    # for "no automated TP/SL-hit detection," flagged as an outstanding
    # gap in the platform audit. Scoped to is_test=True trades ONLY: a
    # genuinely LIVE order already has its SL/TP placed as real
    # broker-side conditional orders (see each _execute_* method in
    # execution_engine.py, which passes stop_loss/take_profit straight
    # to the broker's own place_order call) — the exchange itself
    # already closes those, so this worker would be redundant (and a
    # real risk of a conflicting double-close) there. For paper/Test
    # trades there is no broker enforcing anything, so this is pure
    # simulation with zero real-money exposure — on by default, unlike
    # MARKET_SCANNER_ENABLED, which makes real exchange API calls with
    # real execution consequences.
    POSITION_MONITOR_ENABLED: bool = True
    POSITION_MONITOR_INTERVAL_SECONDS: int = 20

    # MetaApi idle-undeploy sweep (services/metaapi_lifecycle.py) — by
    # direct request ("$9/month is high and a waste of not used ...
    # develop an auto engine that auto-undeploys when not in use").
    # On by default: unlike MARKET_SCANNER_ENABLED this makes no trading
    # decisions and touches no order — it only ever calls MetaApi's
    # undeploy (never deploy) on a connection nobody has traded through
    # recently, and skips any connection with an ACTIVE trade regardless
    # of idle time. Interval is coarse (10 min) since the cost being
    # saved is measured in cents/hour, not something that needs
    # second-level precision.
    METAAPI_IDLE_UNDEPLOY_ENABLED: bool = True
    METAAPI_IDLE_UNDEPLOY_INTERVAL_SECONDS: int = 600

    # Per-bot broker credentials (models/broker_credential.py) are
    # encrypted at rest with this key rather than the JWT SECRET_KEY,
    # so rotating one doesn't affect the other. Generate with:
    #   python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    CREDENTIALS_ENCRYPTION_KEY: str = ""

    # AI Coach (services/ai_coach.py) — Ask Coach's real LLM backend,
    # by direct request ("use the free tier and optimise engine -
    # rotate across multiple"). Every provider here has a genuine free
    # tier; empty by default, and the coach degrades to an honest
    # "not available right now" reply rather than crashing if none are
    # set or every provider call fails.
    GROQ_API_KEY: str = ""
    CEREBRAS_API_KEY: str = ""
    MISTRAL_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Where the Test-mode simulated checkout page (routers/payments.py)
    # sends a user back to after Simulate Success/Failure — the real
    # frontend origin, so this works the same way a real gateway's
    # redirect-back would.
    FRONTEND_URL: str = "https://trade.petrazim.online"

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
