
# SMC Trading Engine — Setup Guide
## For Non-Technical Users (Step by Step)

---

## What You Just Got

A complete **automated trading system** with:
- **5 trading robots** that read charts using Smart Money Concepts
- **A control panel** (like a TV dashboard) to watch and approve trades
- **TradingView connection** so your charts can talk to the robots
- **Risk management** so you don't lose too much money

---

## BEFORE YOU START: What You Need

1. **A computer** (Windows, Mac, or Linux)
2. **Docker Desktop** (free software that runs the system)
   - Download: https://www.docker.com/products/docker-desktop
   - Install it like any normal program
3. **TradingView account** (free version works)
   - Sign up: https://www.tradingview.com

---

## STEP 1: Download Your Files

Your entire project is saved at:
```
/mnt/agents/output/smc_trading_system/
```

You need to download this folder to your computer. Ask your assistant how to download it, or copy it to your local machine.

---

## STEP 2: Start the System (One Command!)

1. Open **Terminal** (Mac) or **Command Prompt** (Windows)
2. Navigate to the project folder:
   ```bash
   cd smc_trading_system
   ```
3. Run this ONE command:
   ```bash
   docker-compose up --build
   ```
4. Wait 2-3 minutes while everything starts up

---

## STEP 3: Open Your Dashboard

Once you see "All Systems Operational" in the terminal:

1. Open your web browser
2. Go to: **http://localhost:3000**
3. You will see your dark trading dashboard!

---

## STEP 4: Connect TradingView

### Option A: Using the Master Indicator
1. In TradingView, open any chart (BTC/USDT, EUR/USD, etc.)
2. Click "Pine Editor" at the bottom
3. Open the file: `tradingview/pinescript/SMC_Master_Engine.pine`
4. Copy ALL the code
5. Paste it into TradingView's Pine Editor
6. Click "Add to Chart"
7. You will see:
   - Green/Red zones (Supply/Demand)
   - Blue/Purple boxes (Fair Value Gaps)
   - Yellow lines (Liquidity levels)
   - Labels for BOS and CHoCH

### Option B: Using Individual Bot Strategies
1. Open `tradingview/pinescript/Bot1_MacroSwing.pine`
2. Copy and paste into TradingView
3. This one actually PLACES practice trades on the chart!
4. Repeat for Bots 2-5

---

## STEP 5: Set Up Alerts (The Robots Start Working)

1. On your TradingView chart, click the "Alerts" icon (clock symbol)
2. Click "Create Alert"
3. Condition: Choose the SMC indicator
4. Message: Leave as default (it sends JSON automatically)
5. Webhook URL: `http://YOUR_COMPUTER_IP:8000/webhook/tradingview`
   - Replace YOUR_COMPUTER_IP with your actual IP address
6. Click "Create"

Now when the indicator finds a trade setup, it automatically sends it to your robot factory!

---

## STEP 6: Approve Trades (Human-in-the-Loop Mode)

1. Go to your dashboard: http://localhost:3000
2. Click "Trades" in the left menu
3. When a robot finds a trade, you'll see it here with "PENDING" status
4. Click "Approve" to let the robot trade
5. Click "Reject" to skip it

---

## STEP 7: Switch to Fully Automatic (Optional)

1. Go to "Bots" in the left menu
2. Find the bot you want to automate
3. Click "Switch to Auto"
4. The bot will trade WITHOUT asking you first

⚠️ **WARNING**: Only do this after you've tested for weeks and trust the system!

---

## What Each Page Does

| Page | What You See | What You Do |
|------|-------------|-------------|
| **Dashboard** | Charts, stats, live signals | Monitor everything at a glance |
| **Trades** | List of all trades | Approve, reject, or review |
| **Bots** | 5 robot cards | Turn robots on/off, change settings |
| **Analytics** | Win rate, profit, drawdown | See how well you're doing |
| **Risk** | Exposure, daily limits | Check if you're trading safely |

---

## Safety Features (Built-In)

The system WON'T let you:
- Risk more than 3% per trade (hard limit)
- Take more than 10 trades per day (configurable)
- Trade if you're in a 10% drawdown (protects your money)
- Trade if higher timeframes disagree (prevents bad entries)

---

## If Something Goes Wrong

**Problem**: "Cannot connect to database"
**Fix**: Wait 30 seconds, then refresh. The database takes time to start.

**Problem**: "Webhook not working"
**Fix**: Check your computer's IP address. It changes on WiFi.

**Problem**: "No trades showing"
**Fix**: The market might be ranging. Wait for a clear trend.

---

## Next Steps (Phase 3-6)

Your assistant will continue building:
- **Phase 3**: Broker connections (Binance, Bybit, MetaTrader)
- **Phase 4**: Advanced analytics and reporting
- **Phase 5**: Mobile-friendly dashboard
- **Phase 6**: Production deployment and security

---

## Remember

- This is a **tool**, not a magic money machine
- **Paper trade first** (practice with fake money)
- **Start small** (0.5% risk per trade)
- **Track your results** weekly
- **Never risk money you can't afford to lose**

Good luck! 🚀
