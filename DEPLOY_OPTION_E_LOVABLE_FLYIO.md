
# Option E: Lovable + Fly.io (RECOMMENDED for 24/7 Trading)

## Why This Is The Best Option

| Feature | Lovable + Fly.io | Other Options |
|---------|-----------------|---------------|
| **Frontend** | Beautiful visual editor (Lovable) | Code-only |
| **Backend** | Stays awake 24/7 (Fly.io) | Sleeps on free tier |
| **Database** | Included free | Extra setup needed |
| **Custom Domain** | Easy on Lovable | More steps |
| **Cost** | $0 forever (if under limits) | $7-22/month |
| **Difficulty** | Medium | Easy to Hard |

## The Setup

### Part 1: Fly.io (The Robot Brain)

Fly.io gives you **3 small virtual machines FREE forever** + **1GB PostgreSQL database FREE**. This is enough to run your trading system 24/7 without paying anything.

**What Fly.io hosts:**
- Your FastAPI backend (the brain)
- Your PostgreSQL database (the notebook)
- Your Redis cache (the messenger)

**What Fly.io gives you:**
- A URL like: `https://smc-trading-engine.fly.dev`
- This URL never sleeps
- Your TradingView alerts always get through
- Your trades execute even at 3 AM

### Part 2: Lovable (The Dashboard)

Lovable hosts your beautiful dark trading dashboard.

**What Lovable hosts:**
- Your React frontend (the screen)
- Your custom domain: `trade.petrazim.online`
- All the pretty charts and buttons

**What Lovable gives you:**
- Visual editing (drag and drop)
- Instant preview
- One-click deploy
- Custom domain support

---

## STEP-BY-STEP SETUP

### Step 1: Sign Up for Fly.io

1. Go to **https://fly.io**
2. Click "Get Started" or "Sign Up"
3. You can sign up with:
   - **GitHub** (recommended — same as Lovable)
   - **Google**
   - **Email**
4. Enter your email and create a password
5. Verify your email (check inbox)
6. **Install Fly CLI** (the tool that talks to Fly.io):

   **On Mac:**
   Open Terminal and paste this ONE command:
   ```bash
   brew install flyctl
   ```

   **On Windows:**
   Open PowerShell and paste this ONE command:
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```

   **On Linux:**
   Open Terminal and paste this ONE command:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

7. **Log in to Fly.io from your computer:**
   ```bash
   fly auth login
   ```
   This opens your browser. Click "Authorize".

### Step 2: Deploy Your Backend to Fly.io

1. Open Terminal / Command Prompt
2. Navigate to your project folder:
   ```bash
   cd smc_trading_system/backend
   ```
3. Run this ONE command:
   ```bash
   fly launch
   ```
4. Fly.io will ask you some questions:
   - **App name:** Type `smc-trading-engine` (or any name you want)
   - **Region:** Pick the closest to you (e.g., `iad` for US East, `lhr` for London)
   - **PostgreSQL:** Type `y` (yes, create database)
   - **Redis:** Type `y` (yes, create cache)
   - **Deploy now:** Type `y` (yes, deploy)
5. Wait 2-3 minutes while Fly.io builds and deploys
6. You'll see a URL like: `https://smc-trading-engine.fly.dev`
7. **Copy this URL** — you need it for Lovable

### Step 3: Set Environment Variables on Fly.io

1. Run these commands ONE BY ONE in Terminal:
   ```bash
   fly secrets set SECRET_KEY="your-random-secret-key-here"
   fly secrets set WEBHOOK_SECRET="your-tradingview-secret-here"
   fly secrets set BINGX_API_KEY="your-bingx-key-here"
   fly secrets set BINGX_SECRET="your-bingx-secret-here"
   fly secrets set TRADELOCKER_API_KEY="your-tradelocker-key-here"
   fly secrets set TRADELOCKER_SECRET="your-tradelocker-secret-here"
   fly secrets set TRADELOCKER_ACCOUNT_ID="your-account-id-here"
   ```

   **IMPORTANT:** Replace the text in quotes with your REAL keys. If you don't have keys yet, skip those lines and add them later.

2. Restart your app:
   ```bash
   fly deploy
   ```

### Step 4: Import Frontend into Lovable

1. Go to **https://lovable.app**
2. Sign in (you already have an account)
3. Click "New Project"
4. Click "Import from GitHub"
5. If you haven't connected GitHub yet, click "Connect GitHub"
6. Create a new GitHub repo called `smc-trading-dashboard`
7. Upload your `frontend` folder to this repo
8. Back in Lovable, select the `smc-trading-dashboard` repo
9. Lovable will import it and show you a preview

### Step 5: Connect Lovable to Fly.io

1. In Lovable, find "Settings" or "Environment Variables"
2. Add these two variables:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://smc-trading-engine.fly.dev` (your Fly.io URL)

   - **Name:** `VITE_WS_URL`
   - **Value:** `wss://smc-trading-engine.fly.dev/ws` (same URL but with `wss://`)
3. Click "Save" and "Redeploy"
4. Lovable will rebuild and connect to your backend

### Step 6: Add Custom Domain

1. In Lovable, go to Project Settings → Custom Domain
2. Enter: `trade.petrazim.online`
3. Lovable will show you DNS records (usually CNAME or A records)
4. **Don't close this page** — you need those records

### Step 7: Configure Your Domain (petrazim.online)

1. Go to wherever you bought `petrazim.online` (Namecheap, GoDaddy, Cloudflare, etc.)
2. Find "DNS Management" or "DNS Records"
3. Add the records that Lovable gave you:
   - Usually a **CNAME** record pointing to Lovable's servers
   - Example: `CNAME | trade | lovable.app` or similar
4. Save and wait 5-30 minutes
5. Go to `https://trade.petrazim.online` — it should work!

---

## COST BREAKDOWN (Fly.io + Lovable)

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| **Fly.io VMs** | 3 shared VMs | 1 VM for backend | **$0** |
| **Fly.io Database** | 1GB PostgreSQL | ~100MB | **$0** |
| **Fly.io Bandwidth** | 160GB/month | ~1GB | **$0** |
| **Lovable** | Unlimited free | 1 project | **$0** |
| **Domain** | — | 1 domain | **$10/year** |

**Total: $0/month + $10/year for domain**

**When you might pay:**
- If you get 1000+ users on your dashboard
- If you're processing millions of trades per month
- For a beginner trader: you'll never hit the free limits

---

## MONITORING YOUR APP

### Check if Fly.io is running:
```bash
fly status
```

### View logs (errors, trades, etc.):
```bash
fly logs
```

### Restart if something breaks:
```bash
fly deploy
```

### Open the app in browser:
```bash
fly open
```

---

## BACKUP PLAN

If Fly.io feels too technical, use **Option A (Render + Netlify)** instead:
- Render is easier to set up (just click buttons, no Terminal)
- But the free tier "sleeps" after 15 minutes
- For live trading, you'd need the $7/month plan
- Total cost: $7/month + $10/year domain

---

## SUMMARY

| Step | What You Do | Time |
|------|-------------|------|
| 1 | Sign up for Fly.io | 5 min |
| 2 | Install Fly CLI | 2 min |
| 3 | Run `fly launch` | 3 min |
| 4 | Wait for deploy | 3 min |
| 5 | Set secrets (API keys) | 5 min |
| 6 | Import into Lovable | 5 min |
| 7 | Connect frontend to backend | 3 min |
| 8 | Add custom domain | 10 min |
| **TOTAL** | | **~36 minutes** |

**Once set up, it runs forever for free.**
