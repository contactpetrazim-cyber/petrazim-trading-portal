
# SMC Trading Engine — Deployment Guide
## For Non-Technical Users (Step by Step)

---

## 🎯 YOUR GOAL

You want your trading dashboard to appear at:
**https://trade.petrazim.online**

And you want it to run 24/7 without your computer being on.

---

## 🏗️ THE REALITY CHECK (Important!)

Your trading system has **TWO PARTS** that need to live on the internet:

### Part 1: The TV Screen (Frontend)
- This is what you SEE — the dark dashboard with charts and buttons
- **Can go on:** Lovable, Netlify, Vercel, GitHub Pages (all free)
- **Why:** It's just a website. No special server needed.

### Part 2: The Robot Brain (Backend)
- This does the THINKING — receives TradingView alerts, runs math, talks to brokers
- **CANNOT go on:** Lovable, Netlify, or GitHub Pages
- **Why:** These are "static hosts" — they only show websites, not run programs
- **Must go on:** Render, Railway, Fly.io, or AWS (free tiers available)

### Part 3: The Notebook (Database)
- This remembers everything — your trades, bot settings, performance history
- **Usually bundled** with the backend on the same platform

---

## 🆓 FREE HOSTING OPTIONS (Recommended)

| Platform | What It Hosts | Free Tier Limits | Difficulty |
|----------|--------------|------------------|------------|
| **Lovable** | Frontend only | Unlimited | ⭐ Easiest |
| **Netlify** | Frontend only | 100GB/month | ⭐ Easy |
| **Render** | Backend + Database | Sleeps after 15 min idle | ⭐⭐ Medium |
| **Railway** | Backend + Database | $5 credit/month | ⭐⭐ Medium |
| **Fly.io** | Backend + Database | Generous free tier | ⭐⭐⭐ Harder |
| **Supabase** | Database only | 500MB | ⭐ Easy |

---

## 🚀 OPTION A: The Easiest Setup (Render + Netlify)

### Step 1: Deploy the Brain (Backend) on Render

1. Go to **https://render.com**
2. Sign up with your Google or GitHub account
3. Click "New +" → "Blueprint"
4. Connect your GitHub repo (or upload the project)
5. Render will read the `render.yaml` file I created and automatically:
   - Create a PostgreSQL database
   - Create a Redis cache
   - Deploy your FastAPI backend
   - Give you a URL like: `https://smc-trading-backend.onrender.com`
6. **Copy that URL** — you'll need it for the frontend

**Note:** Render's free tier "sleeps" after 15 minutes of no activity. First request after sleep takes 30 seconds to wake up. For 24/7 trading, you'd need the $7/month plan.

### Step 2: Deploy the Screen (Frontend) on Netlify

1. Go to **https://netlify.com**
2. Sign up
3. Drag and drop the `frontend/dist` folder (after building)
4. OR connect your GitHub repo
5. Netlify will give you a URL like: `https://smc-dashboard.netlify.app`

### Step 3: Connect Them

1. In Netlify, go to Site Settings → Environment Variables
2. Add:
   - `VITE_API_URL` = your Render backend URL
   - `VITE_WS_URL` = your Render backend URL but with `wss://` instead of `https://`
3. Redeploy the frontend

### Step 4: Custom Domain (trade.petrazim.online)

1. Buy the domain from Namecheap, GoDaddy, or Cloudflare (~$10/year)
2. In Netlify: Domain Settings → Add Custom Domain → enter `trade.petrazim.online`
3. Netlify will show you DNS records to add
4. Go to your domain provider and add those DNS records
5. Wait 5-30 minutes for it to work

---

## 🚀 OPTION B: Lovable + Render (Your Preferred Way)

Since you already use Lovable (https://petrazim-10-modules.lovable.app), this might feel familiar.

### The Problem
Lovable can ONLY host the frontend (the screen you look at). It cannot run the backend (the robot brain).

### The Solution
**Lovable hosts the dashboard. Render hosts the brain.** They talk to each other over the internet.

### Step 1: Prepare Frontend for Lovable

1. Open the `frontend` folder from your project
2. The code is already React + Vite + Tailwind — exactly what Lovable uses
3. Create a new GitHub repo called `smc-trading-dashboard`
4. Upload the `frontend` folder contents to this repo

### Step 2: Import into Lovable

1. Go to **https://lovable.app**
2. Click "Import from GitHub"
3. Select your `smc-trading-dashboard` repo
4. Lovable will automatically recognize the React app
5. You can now edit the design visually!

### Step 3: Deploy the Brain on Render

(Same as Option A, Step 1)

### Step 4: Connect Them

1. In Lovable, find the Settings or Environment section
2. Add environment variables:
   - `VITE_API_URL` = your Render backend URL
   - `VITE_WS_URL` = your Render backend URL with `wss://`
3. Lovable will rebuild and connect to your backend

### Step 5: Custom Domain

1. In Lovable: Project Settings → Custom Domain
2. Enter `trade.petrazim.online`
3. Follow their DNS instructions
4. Your dashboard now lives at your custom domain!

---

## 🚀 OPTION C: Everything on Render (Simplest but Sleeps)

If you want ONE platform to handle everything:

1. Follow Option A, Step 1 (deploy backend on Render)
2. Your backend URL becomes: `https://smc-trading-backend.onrender.com`
3. The backend ALREADY serves the frontend when you visit the root URL
4. So your dashboard is at: `https://smc-trading-backend.onrender.com`
5. Add custom domain in Render settings

**Pros:** One platform, one URL, simple
**Cons:** Free tier sleeps after 15 min (not good for 24/7 trading alerts)

---

## 🚀 OPTION D: 24/7 Always-On (Railway or Fly.io)

If you need the system to NEVER sleep (for live trading):

### Railway.app ($5/month free credit)
1. Go to **https://railway.app**
2. Sign up (you get $5 free credit every month)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Railway reads `railway.toml` and deploys everything
6. Add PostgreSQL and Redis from Railway's dashboard
7. Your app stays awake 24/7 as long as you stay under $5/month

### Fly.io (Most generous free tier)
1. Install Fly CLI (one command)
2. Run `fly launch` in your project folder
3. Fly reads `fly.toml` and deploys
4. You get 3 small VMs free forever + 1GB database
5. Stays awake 24/7

---

## 🔑 ADDING YOUR BROKER API KEYS

Once your backend is deployed, you need to tell it how to connect to your broker.

### Where to Get API Keys

| Broker | Where to Get Keys | URL |
|--------|-------------------|-----|
| **BingX** | Account → API Management | https://bingx.com/en-us/account/api/ |
| **TradeLocker** | Dashboard → API Keys | Your TradeLocker dashboard |
| **Binance** | Profile → API Management | https://www.binance.com/en/my/settings/api-management |
| **Bybit** | Account → API | https://www.bybit.com/app/user/api-management |

### How to Add Them

1. Go to your backend dashboard (Render, Railway, etc.)
2. Find "Environment Variables" or "Secrets"
3. Add each key:
   - `BINGX_API_KEY` = your key
   - `BINGX_SECRET` = your secret
   - `TRADELOCKER_API_KEY` = your key
   - `TRADELOCKER_SECRET` = your secret
   - `TRADELOCKER_ACCOUNT_ID` = your account ID
4. Restart the backend (one click)

**⚠️ SECURITY WARNING:**
- Never share your API keys
- Never commit them to GitHub
- Always use "Environment Variables" or "Secrets" in your hosting platform
- Start with "Read-Only" or "Demo/Testnet" API keys first!

---

## 🧪 TESTING BEFORE GOING LIVE

### Paper Trading Mode (Safe Practice)

Your system starts in **Paper Trading** mode by default. This means:
- ✅ It receives real TradingView alerts
- ✅ It calculates real trade setups
- ✅ It shows them on your dashboard
- ❌ It does NOT send real money to brokers
- ❌ It simulates trades and tracks "fake" P&L

**How to enable:** Just don't add any broker API keys. The system automatically uses paper trading.

### Test Checklist

Before you trade real money:
- [ ] Dashboard loads at your custom domain
- [ ] TradingView alerts appear in the "Pending" section
- [ ] You can click "Approve" and "Reject"
- [ ] Bot status shows "Active"
- [ ] Paper trades show up in the trade history
- [ ] You've tested for at least 1 week
- [ ] You understand every bot's strategy

---

## 🚨 TROUBLESHOOTING

### "My dashboard shows 'Offline'"
**Cause:** Backend is sleeping (Render free tier) or crashed
**Fix:** Visit your backend URL directly to wake it up. Or upgrade to paid plan.

### "TradingView alerts not coming through"
**Cause:** Wrong webhook URL or firewall blocking
**Fix:**
1. Check your webhook URL is correct (must be `https://`, not `http://`)
2. Test with a simple curl command
3. Make sure your backend is awake

### "BingX/TradeLocker orders failing"
**Cause:** Wrong API keys or insufficient permissions
**Fix:**
1. Regenerate API keys
2. Make sure "Futures Trading" or "Spot Trading" permission is enabled
3. Check if you're using Testnet vs Live keys

### "Database connection error"
**Cause:** Database not running or wrong connection string
**Fix:**
1. Check Render/Railway database status
2. Verify DATABASE_URL environment variable
3. Restart the database service

---

## 💰 COST BREAKDOWN (Monthly)

| Setup | Frontend | Backend | Database | Total |
|-------|----------|---------|----------|-------|
| **Free Tier** | $0 (Netlify/Lovable) | $0 (Render sleeps) | $0 (Render/Railway) | **$0** |
| **Always-On** | $0 (Netlify) | $7 (Render) | $0 (included) | **$7** |
| **Premium** | $0 (Netlify) | $7 (Render) | $15 (managed DB) | **$22** |
| **Domain** | — | — | — | **$10/year** |

**My recommendation for beginners:**
- Start with **Option A (Render + Netlify)** on free tier
- Test for 2-4 weeks with paper trading
- If you make money and trust the system, upgrade to $7/month on Render
- Total cost: **$7/month + $10/year for domain**

---

## 📞 WHAT I NEED FROM YOU TO CONTINUE

To set up your custom domain (`trade.petrazim.online`), I need:

1. **Where did you buy the domain?** (Namecheap, GoDaddy, Cloudflare, etc.)
2. **Which hosting option do you prefer?**
   - A: Render + Netlify (easiest, sleeps on free tier)
   - B: Lovable + Render (your preferred, but same sleep issue)
   - C: Railway (stays awake, $5 credit)
   - D: Fly.io (stays awake, most generous free tier)

3. **Do you have API keys yet?** (BingX, TradeLocker, etc.)

Once you tell me, I can generate the EXACT step-by-step instructions for YOUR specific setup.

---

## ✅ NEXT STEPS

1. **Choose your hosting** (A, B, C, or D above)
2. **Sign up** for the platforms
3. **Deploy** using the configs I created
4. **Test** with paper trading for 1-2 weeks
5. **Add broker API keys** when ready
6. **Trade live** with small risk (0.5% per trade)

**Remember:** This is a tool, not a magic money machine. Paper trade first. Start small. Track everything.

Good luck! 🚀
