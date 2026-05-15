# PageFly Quiz Challenge

A small web app that gives PageFly merchants a 20% discount code after they answer 5 questions correctly. Built with Express + EJS + vanilla JS. No database.

- **Domain:** `quiz-challenge.pagefly.io`
- **VPS port:** `3001` (other services on the same box: `refund-mcp:3000`, `upsell-mcp:3002`, `manual-mcp:3003`)
- **Project dir on VPS:** `/var/www/quiz-challenge`

## Local development

```bash
npm install
cp .env.example .env   # fill in DISCOUNT_CODE and (optionally) webhook URL
npm run dev
```

Visit `http://localhost:3001/?sid=test123`.

## Environment variables (`.env`)

| Var                            | Notes                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| `PORT`                         | `3001` on the VPS.                                                    |
| `NODE_ENV`                     | `production` on the VPS.                                              |
| `DISCOUNT_CODE`                | Shared code shown to every winner, e.g. `PF_START20`.                  |
| `QUIZ_COMPLETE_WEBHOOK_URL`    | n8n webhook fired server-side on completion. Leave blank to disable.  |
| `QUIZ_COMPLETE_WEBHOOK_SECRET` | Optional; sent as `X-Webhook-Secret` header.                          |

## Entry flow

1. PageFly app opens `https://quiz-challenge.pagefly.io/?sid=<SHOP_SESSION_ID>`.
2. Server reads `sid`, returns the first question. Missing `sid` → error page.
3. Each answer is POSTed to `/api/answer`; the server validates and returns the next question.
4. After question 5 is answered correctly, the server marks the `sid` complete, fires the webhook, and returns the discount code.
5. Re-entering with the same `sid` after completion shows "You've already claimed your discount" with the code re-displayed.

## API

`POST /api/answer`

Request:
```json
{ "sid": "abc", "questionId": 1, "selectedIndex": 2 }
```

Response (correct, not final):
```json
{
  "correct": true,
  "nextQuestionId": 2,
  "completed": false,
  "nextQuestion": { "id": 2, "question": "...", "options": ["...", "..."] },
  "nextIndex": 1,
  "total": 5
}
```

Response (correct, final):
```json
{
  "correct": true,
  "nextQuestionId": null,
  "completed": true,
  "discountCode": "PF_START20",
  "total": 5
}
```

Response (wrong):
```json
{ "correct": false, "nextQuestionId": null, "completed": false, ... }
```

The `correctIndex` for any question is **never** sent to the client.

## Webhook payload

`POST` to `QUIZ_COMPLETE_WEBHOOK_URL` (with optional `X-Webhook-Secret`):
```json
{
  "sid": "<shop session id>",
  "completedAt": "2026-05-15T10:00:00.000Z",
  "discountCode": "PF_START20",
  "event": "quiz-complete"
}
```

Fire-and-forget. One retry after 2 seconds, then give up. Failures are logged but never block the user UI.

---

## Deploy to VPS

The target VPS is `pf-support` (Ubuntu). DNS for `quiz-challenge.pagefly.io` already points to it, and nginx is already configured at `/etc/nginx/conf.d/quiz-challenge.conf` proxying to `127.0.0.1:3001`. HTTPS is **not yet configured** — you'll do that in Step 8.

### Step 1 — Get code onto the VPS
```bash
cd /var/www
sudo git clone <your-repo-url> quiz-challenge
sudo chown -R $USER:$USER /var/www/quiz-challenge
cd quiz-challenge
```

### Step 2 — Install dependencies
```bash
# Check Node version (need 20.x or higher)
node -v

# If Node is missing or too old:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install project deps
npm install --production
```

### Step 3 — Configure environment
```bash
cp .env.example .env
nano .env
```
Fill in:
```
PORT=3001
NODE_ENV=production
DISCOUNT_CODE=PF_START20
QUIZ_COMPLETE_WEBHOOK_URL=
QUIZ_COMPLETE_WEBHOOK_SECRET=
```
Save (`Ctrl+O`, Enter, `Ctrl+X`) and tighten permissions:
```bash
chmod 600 .env
```

### Step 4 — Verify the app binds to 127.0.0.1
`src/server.js` already calls:
```javascript
app.listen(port, '127.0.0.1', () => { ... });
```
This means only nginx (on the same box) can reach the app — never expose it directly to the public internet.

### Step 5 — Test the app standalone (before PM2)
```bash
node src/server.js
# In another terminal:
curl http://127.0.0.1:3001
# Should return the error HTML (because no sid was supplied) — that's a healthy sign.
# Stop with Ctrl+C.
```

### Step 6 — Install and configure PM2
```bash
# Install PM2 globally if not present
sudo npm install -g pm2

# Start the app (uses ecosystem.config.js)
pm2 start ecosystem.config.js

# Verify
pm2 list
pm2 logs quiz-challenge --lines 50

# Persist the process list so PM2 restores it on reboot
pm2 save

# Generate the systemd startup script — run the command pm2 outputs
pm2 startup
```

### Step 7 — Verify nginx is routing correctly
```bash
# From the VPS itself
curl -H "Host: quiz-challenge.pagefly.io" http://127.0.0.1

# From your local machine
curl http://quiz-challenge.pagefly.io
```
Both should return the quiz HTML (or the error page if `sid` is missing — either way, a 200/400 from Express, not a 502).

### Step 8 — Set up HTTPS with Let's Encrypt
HTTPS is **required** because the PageFly app passes `sid` in the URL — HTTPS prevents `sid` from being sniffed.
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d quiz-challenge.pagefly.io
```
Follow the prompts:
- Enter email for renewal notifications.
- Agree to TOS.
- Choose redirect (option 2) — auto-redirect HTTP → HTTPS.

Certbot rewrites `/etc/nginx/conf.d/quiz-challenge.conf` to add the SSL server block and sets up auto-renewal. Verify:
```bash
sudo certbot renew --dry-run
curl https://quiz-challenge.pagefly.io
```

### Step 9 — Final smoke test
Open in browser:
```
https://quiz-challenge.pagefly.io/?sid=test-shop-123
```
Should show question 1. Answer all 5 correctly → you should see the discount code and confetti.

---

## Updating the app later

```bash
cd /var/www/quiz-challenge
git pull
npm install --production
pm2 restart quiz-challenge
pm2 logs quiz-challenge --lines 50
```

> ⚠️ `pm2 restart` re-reads `.env`. If you only edit `.env`, you still need `pm2 restart quiz-challenge` — PM2 caches env at process start.

## Common troubleshooting

| Symptom                                  | Check                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| 502 Bad Gateway                          | App not running → `pm2 list`, `pm2 logs quiz-challenge`                              |
| Connection refused                       | Wrong port → `sudo ss -tlnp \| grep 3001`                                            |
| Webhook not firing                       | `pm2 logs quiz-challenge` for fetch errors; verify `QUIZ_COMPLETE_WEBHOOK_URL`       |
| Changes to `.env` not taking effect      | `pm2 restart quiz-challenge` (PM2 caches env at start)                               |
| Cert renewal failing                     | `sudo certbot renew --dry-run`; check port 80 is open                                |
| In-memory state lost after restart       | Expected — users just refresh. Persisting state across restarts is out of scope (v1) |

## State & limits (v1)

- Per-`sid` quiz progress lives in memory (`Map`). Server restart resets progress.
- Per-`sid` completion lives in memory (`Set`). Subsequent attempts with the same `sid` show "already claimed".
- No persistence, no rate limiting, no email collection, no per-user codes — see SPEC.md "Out of Scope".

## Editing questions

Edit `questions.json`. Each entry has `{ id, question, options[4], correctIndex }`. `correctIndex` and the full questions array are only used server-side; the client only sees `{ id, question, options }`.
