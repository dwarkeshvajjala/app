# Internal testing environment — setup & team guide

A real, always-on testing version of Backline that your whole team can use from any
browser, with **their own email addresses and real sign-in codes**. No domain purchase,
no software for your team to install.

**You do:** ~2 hours of setup, once.
**Your team does:** click a link. That's genuinely it.
**Cost:** ~$5/month.

> This is the "staging" environment. It's a real deployment on the internet — it just
> uses free hosting URLs instead of your own domain. When you're ready to sell, you
> point a domain at this exact setup (see [Part G](#part-g--going-from-testing-to-production)).

---

## Contents

- [What's already done](#whats-already-done)
- [Part A — What YOU set up (~2 hours)](#part-a--what-you-set-up-2-hours)
- [Part B — What your TEAM does (2 minutes)](#part-b--what-your-team-does-2-minutes)
- [Part C — How to use the app](#part-c--how-to-use-the-app)
- [Part D — What to test (QA checklist)](#part-d--what-to-test-qa-checklist)
- [Part E — What NOT to test (known gaps)](#part-e--what-not-to-test-known-gaps)
- [Part F — How to report bugs](#part-f--how-to-report-bugs)
- [Part G — Going from testing to production](#part-g--going-from-testing-to-production)
- [Troubleshooting](#troubleshooting)

---

## What's already done

| ✅ Done | Detail |
|---|---|
| Code is on GitHub | `minute-creative/backline`, **private**, verified no secrets uploaded |
| Database is live | MongoDB Atlas `backline-prod`, Mumbai, 3-node replica set |
| DB network access | Verified reachable — port 27017 open on all 3 nodes |
| Production fixes | Widget-in-Docker, SPA routing, env template — all committed |

| ⏳ Not done yet | Where |
|---|---|
| Confirm your Atlas **password** works | one command, below |
| File storage (R2) | Part A2 |
| Email sending | Part A3 |
| Secret keys | Part A4 |
| Backend + dashboard deployed | Parts A5, A6 |

### Do this first (30 seconds)

You still haven't confirmed your database password. A wrong one shows up much later as a
confusing deploy error, so check it now:

```bash
cd ~/Q_A_TOOL/backend && uv run python scripts/check_mongo_connection.py
```

Type the password when asked — **nothing appears on screen as you type**, that's normal.
You want `✅ CONNECTED`. If it fails, the script tells you exactly which problem it is.

---

## Part A — What YOU set up (~2 hours)

### A1. The one thing about email you must understand

Your app signs people in by emailing a 6-digit code. Email services won't let you send to
arbitrary strangers from a shared address — so **without a verified domain, your teammates
would never receive their codes.** Only you would.

**You don't need to buy anything.** You already own `minutecreative.com`.

> ⚠️ **Verify a *subdomain*, not your main domain.** Use `send.minutecreative.com`.
> Your company email already runs on `minutecreative.com`; adding sending records to the
> root domain risks disturbing it. A subdomain is completely isolated, and is Resend's
> own recommendation.

---

### A2. File storage — Cloudflare R2 (15 min)

Holds screenshots and comment attachments.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**
2. It asks for a card even on the free tier (10 GB/month free) — add it
3. **Create bucket** → name: `backline-testing` → **Create**
4. Leave it **private**. Never enable public access — your app hands out temporary signed
   links instead, so screenshots can't be found by strangers guessing URLs.
5. **Manage R2 API Tokens** → **Create API Token**
   - Name: `backline-backend`
   - Permissions: **Object Read & Write**
   - Specify bucket: `backline-testing` only
6. **Copy all three values now** — the secret is shown only once:
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`
   - Endpoint (`https://xxx.r2.cloudflarestorage.com`) → `R2_ENDPOINT_URL`
7. Account ID is on the R2 overview page → `R2_ACCOUNT_ID`

**Verify before moving on** (30 seconds — don't discover a typo during deploy):

```bash
cd ~/Q_A_TOOL/backend && uv run python scripts/check_r2_connection.py
```

It runs exactly what your app does: uploads a file, creates a signed link, downloads it
back, deletes it. You want `✅ ALL CHECKS PASSED`. On failure it names the likely cause
(wrong key / wrong bucket / read-only token) and the fix.

---

### A3. Email — Resend (20 min + DNS wait)

1. [resend.com](https://resend.com) → sign up → **Domains** → **Add Domain**
2. Enter **`send.minutecreative.com`** (the subdomain, not the bare domain)
3. Resend shows DNS records (DKIM, SPF, sometimes DMARC)
4. Go to wherever `minutecreative.com`'s DNS is managed and add each record **exactly** —
   copy/paste, never retype
5. Click **Verify**. Usually 15–30 minutes; can take a few hours.
6. Once verified: **API Keys** → **Create API Key**
   - Name: `backline-testing`
   - Permission: **Sending access**
   - Copy the key (`re_...`) → `RESEND_API_KEY`
7. Your from-address → `RESEND_FROM_ADDRESS`:
   `Backline Testing <hello@send.minutecreative.com>`

**While DNS propagates, continue with A4–A6.** You can add the email key afterwards.

---

### A4. Secret keys (2 min)

Two keys must be changed from their built-in defaults — the defaults are visible in your
source code, so leaving them means anyone could forge a login.

Open Terminal. Run each line, save each output:

```bash
openssl rand -hex 32
```
→ `JWT_SIGNING_KEY`

```bash
cd ~/Q_A_TOOL/backend && uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
→ `INTEGRATIONS_ENCRYPTION_KEY`

Store both in a password manager. Never paste them into chat or a screenshot.

---

### A5. Backend — Railway (30 min)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. **Configure GitHub App** → grant access to the **minute-creative** org → pick `backline`
3. The first build may fail — expected. Configure it:

**Settings → Source:**
- **Root Directory:** leave **EMPTY** (repo root) — **not** `backend`
- **Dockerfile Path:** `backend/Dockerfile`

> **Why root?** Your backend also serves the review widget, built from `apps/widget/`,
> which lives outside `backend/`. With `backend/` as root the widget isn't in the image
> and it **silently 404s** — reviewers would see the site with no commenting layer and
> no error anywhere. This was a real bug I found and fixed; this setting is what keeps
> the fix working.

**Settings → Networking:** click **Generate Domain** → copy it. This is your **API URL**,
e.g. `backline-production-abc1.up.railway.app`.

**Add Redis:** **+ New** → **Database** → **Add Redis**. Done, it wires itself in.

**Variables → RAW Editor** — paste this, substituting your saved values. Leave the two
URL lines as shown for now; you'll fix them in A7:

```
ENVIRONMENT=production
MONGO_URI=mongodb+srv://backline_app:YOURPASSWORD@backline-prod.adieyyw.mongodb.net/?retryWrites=true&w=majority&appName=backline-prod
MONGO_DB_NAME=backline_testing
REDIS_URL=${{Redis.REDIS_URL}}
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=backline-testing
R2_ENDPOINT_URL=https://....r2.cloudflarestorage.com
JWT_SIGNING_KEY=...
INTEGRATIONS_ENCRYPTION_KEY=...
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=Backline Testing <hello@send.minutecreative.com>
CORS_ALLOW_ORIGINS=["https://PLACEHOLDER.vercel.app"]
PUBLIC_API_BASE_URL=https://YOUR-API-URL.up.railway.app
PUBLIC_DASHBOARD_BASE_URL=https://PLACEHOLDER.vercel.app
```

> 🚨 **`CORS_ALLOW_ORIGINS` must be square brackets + double quotes.** A plain
> comma-separated list **crashes the app at startup**. I tested this — it's the single
> most common mistake here.

> 📌 `MONGO_DB_NAME=backline_testing` (not `backline_prod`) — so your team's messy test
> data lives in a separate database from real customer data later. Same cluster, separate
> drawer.

**Check it worked:** open `https://YOUR-API-URL.up.railway.app/health`
You want: `{"status":"ok","mongo":"ok","redis":"ok"}`

**Add the background worker** (handles re-finding comments when a site changes, and
digest emails):

1. **+ New** → **GitHub Repo** → pick `backline` again (same repo, second service)
2. Settings: Root Directory **empty**, Dockerfile Path `backend/Dockerfile`
3. **Custom Start Command:** `arq app.workers.main.WorkerSettings`
4. **Do not** generate a domain for this one
5. Variables → paste **the same block** as above
6. Log should read `Starting worker for N functions`

---

### A6. Dashboard — Vercel (15 min)

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import `backline`
2. **Framework Preset:** Vite
3. **Root Directory:** click **Edit** → choose **`apps/web`** ← required
4. **Environment Variables:**

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-API-URL.up.railway.app` |

5. **Deploy**. You get a URL like `backline-xyz.vercel.app` — this is your **dashboard URL**.

---

### A7. Connect the two (5 min) — don't skip

Both services were deployed with placeholder addresses. Point them at each other.

**Railway → backend service → Variables**, fix these two:
```
CORS_ALLOW_ORIGINS=["https://YOUR-DASHBOARD.vercel.app"]
PUBLIC_DASHBOARD_BASE_URL=https://YOUR-DASHBOARD.vercel.app
```
**Railway → worker service → Variables** — same two.

No trailing slashes. `https`, not `http`.

**Why:** `CORS_ALLOW_ORIGINS` is a security list — the backend refuses browser requests
from any origin not on it. Wrong here and the dashboard loads but every click fails.

Then **Vercel → Deployments → ⋯ → Redeploy** (the `VITE_` values are baked in at build
time, so a change needs a rebuild).

---

### A8. Invite your team

1. Open your dashboard URL, sign in with **your own email**
2. Create a workspace, e.g. `Minute Creative`
3. Left sidebar → **Members** → **+ Add Member**
4. Enter each teammate's email, choose a role:
   - **Admin** — can invite others, change settings (your leads)
   - **Member** — full use, can't manage the workspace (everyone else)
5. Send them Part B below, plus your dashboard URL

---

## Part B — What your TEAM does (2 minutes)

**Nothing to install. No accounts to create. No setup.** Send them this:

> **Testing Backline**
>
> 1. Open **`https://YOUR-DASHBOARD.vercel.app`** in Chrome
> 2. Type **your work email** → **Send sign-in code**
> 3. Check your inbox for a 6-digit code (check spam the first time)
> 4. Enter it — you're in
>
> That's it. Any computer, any browser. Nothing to download.

**Sign-in is passwordless** — a fresh code each time, valid 10 minutes. There's no
password to create or forget.

---

## Part C — How to use the app

### The two roles

Backline has two kinds of people, and testing both matters:

| | **Team member** (you) | **Reviewer** (your client) |
|---|---|---|
| Who | Agency staff | The client giving feedback |
| Access | Signs in with email | Just opens a link — **no account** |
| Sees | Full dashboard | Only their site + comment tools |

### C1. Create a project

1. **+ New Project** (top right)
2. **Name:** e.g. `Acme Homepage`
3. **Site URL:** the full address, e.g. `https://minutecreative.com`
4. **Create project**

### C2. Review a site yourself

Click the project. The site loads inside the canvas.

**The footer bar:**
- **Version 1** — version history (not functional yet)
- **Monitor icon** — switch viewport (iPhone, iPad, etc.) — *this works, test it*
- **Share** — invite teammates
- **Browse / Comment** — ⚠️ **the important one**
  - **Comment** (default): clicking the page leaves a comment
  - **Browse**: clicking behaves normally, so you can navigate the site
- Upgrade to Pro / tick / Private Mode — **not functional**, ignore

**To comment:** make sure **Comment** is selected, then click anywhere on the page.
A pin drops and a box opens. Type your note, optionally attach a file with the
**paperclip**, then **Capture & prepare comment**.

**The right-hand tabs:**
- **Details** — project info
- **Comments** — every comment; filter by status, sort, click one to jump to it
- **MCP / BugHunt ai** — **not functional**

### C3. Share with a reviewer (the client experience)

⚠️ **This is the step with a real gotcha.**

1. Project → **Share links** (top right)
2. **Mode:** choose **Proxy (install-free)** ← **important**
3. Optionally set a passcode
4. **Create share link** → copy it

> **Why Proxy?** The dropdown defaults to **Snippet**, which only works if Backline's
> code is already installed on the target website. For testing on sites you don't
> control, **always choose Proxy** — it works on any site with no installation.

5. Send that link to a teammate acting as "the client"
6. They open it → type a display name → the site appears with commenting enabled
7. They click and comment — **no account needed**

Comments from reviewers appear live in your dashboard.

### C4. Manage feedback

- **Comments panel** — filter by **Active / In Progress / Resolved / Won't Fix**; click a
  status chip to see only those; click a comment to jump to its pin
- **"..." on a comment** → move it between statuses, or delete the thread
- **✓ button** → mark resolved
- **Board** (top right) → all comments as a kanban board

---

## Part D — What to test (QA checklist)

Give this to each tester. **The goal is to break it.**

### Sign-in
- [ ] Code arrives within ~1 minute
- [ ] Wrong code is rejected
- [ ] Expired code (wait 10+ min) is rejected
- [ ] Sign out, sign back in

### Projects
- [ ] Create a project with a real site
- [ ] Try a site that's slow, or heavy with images
- [ ] Try a site with a cookie banner or popup
- [ ] Search and sort on the dashboard

### Commenting — the core loop
- [ ] Comment on a heading, a paragraph, a button, an image
- [ ] Comment on a specific **word in the middle of a paragraph**
- [ ] **Refresh — is the pin still exactly where you put it?**
- [ ] Attach an image, a PDF, a spreadsheet
- [ ] Click an attachment — does it open?
- [ ] Reply to a thread; edit your own comment; delete it
- [ ] Scroll — do pins stay attached?
- [ ] Switch viewport to mobile — do pins still make sense?

### Reviewer flow (use incognito)
- [ ] Open a **Proxy** share link in a private window
- [ ] Comment as a reviewer without signing in
- [ ] Does it appear in the dashboard **live**, without refresh?
- [ ] Test a passcode-protected link

### Team
- [ ] Two people comment on the same project simultaneously
- [ ] Invite a member; confirm they land in the right workspace
- [ ] Change a role; remove a member

### Security (please actually try)
- [ ] In incognito, open the dashboard URL directly — you must be asked to sign in
- [ ] As a reviewer, try to reach the dashboard — you shouldn't get in

---

## Part E — What NOT to test (known gaps)

These are **not bugs** — they're unbuilt. Don't file them:

| Feature | What happens |
|---|---|
| **Payments / Upgrade to Pro** | Popup appears, button does nothing |
| **Plan limits** | Not enforced — everything is unlimited |
| Web App / Mobile / Image & PDF projects | "Coming soon" popup — only **Website** works |
| MCP Server page | "Coming soon" |
| AI Usage page | Always zeros — no AI feature exists |
| Version history | Leads to the paywall popup |
| Page approval / Private Mode | Lead to the paywall popup |

**Also expected, not a bug:** a pin disappears when its element scrolls out of view, and a
comment can't be placed if that part of the site was redesigned away. Click the comment in
the Comments panel to jump to it.

---

## Part F — How to report bugs

Use your GitHub repo's **Issues** tab (free, already set up, keeps everything in one place):

`https://github.com/minute-creative/backline/issues` → **New issue**

Ask testers to include:
1. **What I did** — the exact steps
2. **What I expected**
3. **What actually happened**
4. **Screenshot** (Mac: `Cmd+Shift+4`)
5. **Which site** and **which browser**

> Testers need a **free GitHub account** and must be added to the org to file issues. If
> that's friction, use a shared spreadsheet instead — the structure above matters more
> than the tool.

---

## Part G — Going from testing to production

When testing is done and you're ready to sell, you **don't rebuild anything**:

1. **Buy a domain** (or use `minutecreative.com`)
2. Add `app.` and `api.` subdomains in Vercel and Railway (Part 10 of `DEPLOYMENT.md`)
3. **Change exactly 4 values** and redeploy:
   - Railway: `CORS_ALLOW_ORIGINS`, `PUBLIC_API_BASE_URL`, `PUBLIC_DASHBOARD_BASE_URL`
   - Vercel: `VITE_API_BASE_URL`
4. Change `MONGO_DB_NAME` to `backline_prod` — a clean database, no test junk
5. **Upgrade Atlas to M10** for automatic backups (see below)
6. Follow the rest of `DEPLOYMENT.md` — Parts 15–17 (backups, legal, billing)

### ⚠️ Two things that are fine for testing but NOT for customers

- **Atlas M0 has no backups.** Deleted data is gone permanently. Fine for throwaway test
  data; **not** acceptable once a customer's work is in there.
- **Signup is open** — anyone with the URL can register. Your data is safe (workspaces are
  strictly isolated, enforced by tests in the repo — a stranger gets their own empty
  workspace and cannot see yours), but don't post the URL publicly.

---

## Troubleshooting

**Sign-in code never arrives**
- Resend domain not verified yet, or `RESEND_API_KEY` missing → codes only go to the
  Railway log. Check Resend's dashboard for delivery failures. Check spam.
- Sending from a domain that isn't the verified one → check `RESEND_FROM_ADDRESS`

**Dashboard loads but every action fails**
- `CORS_ALLOW_ORIGINS` doesn't exactly match your Vercel URL (https, no trailing slash)
- Or you changed `VITE_API_BASE_URL` and **didn't redeploy Vercel**

**Backend won't start**
Read the Railway log:
- `error parsing value for field "cors_allow_origins"` → not a JSON array. Must be
  `["https://your-app.vercel.app"]`
- `mongo: unreachable` → password wrong, or `<db_password>` placeholder left in

**Clicking the site does nothing (no pin)**
- Is the footer set to **Comment**, not Browse?
- Open `https://YOUR-API-URL.up.railway.app/widget/sdk.js` — it must download a file.
  404 means Railway's **Root Directory** isn't empty (see A5).

**Refreshing a dashboard page shows 404**
- `apps/web/vercel.json` missing — it's committed, so re-check Vercel's Root Directory is
  `apps/web`

**Reviewer link shows the site but no commenting**
- The link is **Snippet** mode. Create a new one in **Proxy** mode (C3).
