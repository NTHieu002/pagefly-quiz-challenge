# PageFly Quiz Challenge - Build Specification

## Overview
Build a quiz challenge web app for PageFly merchants. Merchants land on the quiz page from inside the PageFly app, answer 5 questions about PageFly, and if they complete the quiz they receive a 20% discount code. A webhook notifies an external n8n workflow when the quiz is completed.

## Domain & Hosting
- Domain: `quiz-challenge.pagefly.io` (already pointed to VPS, nginx configured)
- Deploy target: VPS with Node.js + nginx reverse proxy
- Process manager: PM2 (preferred) or systemd

## Tech Stack
- **Runtime:** Node.js (LTS, 20.x or 22.x)
- **Framework:** Express.js (lightweight) + server-rendered EJS templates **OR** Next.js if SPA-style preferred. Default to **Express + EJS + vanilla JS frontend** for simplicity and easy nginx deploy.
- **Styling:** Tailwind CSS (via CDN is fine, or built locally)
- **No database needed** — questions are hardcoded, no per-user state stored.
- **HTTP client:** native `fetch` (Node 20+) for webhook calls.
- **Env config:** `dotenv` for `.env` file.

## URL & Entry Flow
1. User opens `https://quiz-challenge.pagefly.io/?sid=<SHOP_SESSION_ID>`
2. `sid` is a query parameter passed by the PageFly app — read it once on page load and keep it in memory (e.g. JS variable or hidden field). Do **not** require it in the URL after first load.
3. If `sid` is missing or empty → show an error page: "Invalid access. Please open the quiz from inside the PageFly app."

## Quiz Page UX
- Single-page experience, no routing.
- Branding: PageFly logo at top, clean modern look matching PageFly's brand (use PageFly's actual colors — primary orange/coral `#EE5A37`-ish, dark text, white background). Frontend designer should match PageFly's marketing site aesthetic.
- Mobile-responsive.

### Question Display
- Show **one question at a time** (not all 5 on one page).
- For each question: question text + 4 multiple-choice options as buttons/radio cards.
- After user picks an answer:
  - If **correct** → show brief "Correct!" feedback (green check), then auto-advance to next question after ~800ms.
  - If **wrong** → show "Wrong answer — game over" screen with a "Refresh to try again" button. User cannot continue; they must refresh the page to restart. No way to skip back.
- Progress indicator: "Question 2 of 5" at top.

### After All 5 Correct
- Show success screen: confetti or celebration animation (use `canvas-confetti` library via CDN).
- Display the discount code prominently in a copy-to-clipboard box.
- Discount code is the **same for everyone** — read from `.env` as `DISCOUNT_CODE` (e.g. `PAGEFLY20`).
- Show short instructions: "Use this code at checkout to get 20% off."
- Trigger the `quiz-complete` webhook (see below) when this screen renders. Fire-and-forget — do not block UI if webhook fails, but do log errors server-side.

## Questions (hardcoded in `questions.json`)
Create a JSON file with 5 questions. Each question shape:
```json
{
  "id": 1,
  "question": "Question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 2
}
```
Use these placeholder PageFly-related questions — the team will refine wording later:

1. What is PageFly primarily used for?
   - A) Email marketing
   - B) **Building custom Shopify store pages without code** ✓
   - C) Inventory management
   - D) Shipping calculation

2. Which Shopify plans is PageFly compatible with?
   - A) Only Shopify Plus
   - B) Only Basic Shopify
   - C) **All Shopify plans** ✓
   - D) Only Advanced Shopify

3. Which of these can you build with PageFly?
   - A) Only product pages
   - B) Only landing pages
   - C) Only blog posts
   - D) **Home, product, collection, landing, blog, and more** ✓

4. Does PageFly require coding skills?
   - A) Yes, you need to know Liquid
   - B) Yes, you need React knowledge
   - C) **No, it's a drag-and-drop visual editor** ✓
   - D) Only for advanced features

5. Which of these is a PageFly feature?
   - A) **A/B testing for pages, Smart Pages, AI builder** ✓
   - B) Sending email campaigns
   - C) Managing physical inventory
   - D) Processing refunds

**Important:** `correctIndex` and the full questions array must **never be sent to the client**. The client only receives `{ id, question, options }`. Answer validation happens server-side.

## Server-Side Answer Validation
- Endpoint: `POST /api/answer`
- Body: `{ sid, questionId, selectedIndex }`
- Response: `{ correct: true|false, nextQuestionId: number|null, completed: boolean }`
- If `correct: false`, the client shows the game-over screen.
- If `completed: true` (i.e. user just answered question 5 correctly), server response also includes `discountCode: "<from env>"`.

### Light state tracking
Since there's no DB, track quiz progress per `sid` in memory (a `Map<sid, currentQuestionIndex>`). Reset on server restart is acceptable — users just refresh. To prevent skipping ahead, server should refuse to validate question N+1 until N has been answered correctly.

## Webhook on Completion
- Endpoint to call: read from `.env` as `QUIZ_COMPLETE_WEBHOOK_URL` (n8n webhook — will be filled in later, leave blank for now and skip the call if empty).
- Method: `POST`
- Headers: `Content-Type: application/json`, optional `X-Webhook-Secret` from env `QUIZ_COMPLETE_WEBHOOK_SECRET`.
- Body:
  ```json
  {
    "sid": "<shop session id from URL>",
    "completedAt": "<ISO 8601 timestamp>",
    "discountCode": "<the code that was given>",
    "event": "quiz-complete"
  }
  ```
- Trigger: server-side, immediately after validating that the user just answered question 5 correctly. Do **not** trust the client to fire this.
- Behavior on failure: log error, do not surface to user (they still get the code). Retry once after 2 seconds, then give up.

## Anti-Abuse (minimal)
- Same `sid` should only successfully complete the quiz once per server lifetime (track in memory: `Set<sid>` of completed). Subsequent attempts with same `sid` → show "You've already claimed your discount" screen with the code re-displayed.
- No rate limiting needed beyond this for v1.

## Project Structure
```
quiz-challenge/
├── src/
│   ├── server.js              # Express app entry
│   ├── routes/
│   │   ├── index.js           # GET / → render quiz page
│   │   └── api.js             # POST /api/answer
│   ├── lib/
│   │   ├── quiz-state.js      # in-memory state (current question per sid, completed sids)
│   │   ├── webhook.js         # fires quiz-complete webhook
│   │   └── questions.js       # loads + serves questions (sanitized for client)
│   └── views/
│       ├── quiz.ejs           # main quiz page
│       └── error.ejs
├── public/
│   ├── js/quiz.js             # client-side quiz logic
│   ├── css/styles.css         # compiled tailwind or hand-written
│   └── img/                   # logo etc.
├── questions.json
├── .env.example
├── .env                       # gitignored
├── package.json
├── ecosystem.config.js        # PM2 config
├── nginx.conf.example         # sample nginx block for reference
└── README.md
```

## .env.example
```
PORT=3000
NODE_ENV=production
DISCOUNT_CODE=PAGEFLY20
QUIZ_COMPLETE_WEBHOOK_URL=
QUIZ_COMPLETE_WEBHOOK_SECRET=
```

## Nginx (reference only, already set up on VPS)
The existing nginx config should reverse-proxy `quiz-challenge.pagefly.io` to `http://127.0.0.1:3000`. Include a sample `nginx.conf.example` in the repo for documentation.

## VPS Environment (already configured)

The target VPS has the following already in place:

| Item | Value |
|------|-------|
| Server | `pf-support` (Ubuntu) |
| Domain | `quiz-challenge.pagefly.io` (DNS pointed) |
| Nginx config | `/etc/nginx/conf.d/quiz-challenge.conf` (already exists, proxies to `127.0.0.1:3001`) |
| Port assigned | **3001** |
| Project directory | `/var/www/quiz-challenge` (create on first deploy) |
| Other services running | `refund-mcp` (3000), `upsell-mcp` (3002), `manual-mcp` (3003) |
| HTTPS | **Not yet configured** — needs certbot |

### Existing nginx config (for reference)
```nginx
server {
    listen 80;
    server_name quiz-challenge.pagefly.io;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

If headers above are missing, edit `/etc/nginx/conf.d/quiz-challenge.conf` and add them, then:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Deploy Instructions (full guide for README.md)

### Step 1 — Get code onto the VPS
SSH into the VPS, then:
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

# If Node not installed or too old:
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
DISCOUNT_CODE=PAGEFLY20
QUIZ_COMPLETE_WEBHOOK_URL=
QUIZ_COMPLETE_WEBHOOK_SECRET=
```
Save (`Ctrl+O`, Enter, `Ctrl+X`), then secure the file:
```bash
chmod 600 .env
```

### Step 4 — Verify app binds to 127.0.0.1
Open `src/server.js` and confirm the listen call uses `127.0.0.1`:
```javascript
app.listen(process.env.PORT || 3001, '127.0.0.1', () => {
  console.log(`Listening on 127.0.0.1:${process.env.PORT}`);
});
```
This ensures only nginx can reach the app, not the public internet directly.

### Step 5 — Test app standalone (before PM2)
```bash
node src/server.js
# In another terminal:
curl http://127.0.0.1:3001
# Should return the quiz HTML or error page
# Stop with Ctrl+C
```

### Step 6 — Install and configure PM2
```bash
# Install PM2 globally if not present
sudo npm install -g pm2

# Start the app
pm2 start ecosystem.config.js

# Verify it's running
pm2 list
pm2 logs quiz-challenge --lines 50

# Save process list so PM2 restores it on reboot
pm2 save

# Enable PM2 to start on boot (run the command it outputs)
pm2 startup
```

### Step 7 — Verify nginx is routing correctly
```bash
# From the VPS itself
curl -H "Host: quiz-challenge.pagefly.io" http://127.0.0.1

# From your local machine
curl http://quiz-challenge.pagefly.io
```
Both should return the quiz HTML.

### Step 8 — Setup HTTPS with Let's Encrypt
This is **required** because the PageFly app will pass `sid` over the URL. HTTPS prevents `sid` from being sniffed.
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d quiz-challenge.pagefly.io
```
Follow the prompts:
- Enter email for renewal notifications
- Agree to TOS
- Choose redirect (option 2) — auto-redirect HTTP → HTTPS

Certbot will automatically modify `/etc/nginx/conf.d/quiz-challenge.conf` to add SSL and set up auto-renewal. Verify:
```bash
sudo certbot renew --dry-run
curl https://quiz-challenge.pagefly.io
```

### Step 9 — Final smoke test
Open in browser:
```
https://quiz-challenge.pagefly.io/?sid=test-shop-123
```
Should show question 1. Answer all 5 correctly → see discount code.

## PM2 ecosystem.config.js (template)
```javascript
module.exports = {
  apps: [{
    name: 'quiz-challenge',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    time: true
  }]
};
```

## Updating the app later
```bash
cd /var/www/quiz-challenge
git pull
npm install --production
pm2 restart quiz-challenge
pm2 logs quiz-challenge --lines 50
```

## Common troubleshooting

| Symptom | Check |
|---------|-------|
| 502 Bad Gateway | App not running → `pm2 list`, `pm2 logs quiz-challenge` |
| Connection refused | Wrong port → `sudo ss -tlnp \| grep 3001` |
| Webhook not firing | `pm2 logs quiz-challenge` for fetch errors; verify `QUIZ_COMPLETE_WEBHOOK_URL` in `.env` |
| Changes to `.env` not taking effect | `pm2 restart quiz-challenge` (PM2 caches env at start) |
| Cert renewal failing | `sudo certbot renew --dry-run`; check port 80 is open |

## Acceptance Criteria
- [ ] Visiting `/?sid=test123` shows question 1.
- [ ] Visiting `/` without `sid` shows the error page.
- [ ] Answering correctly advances to the next question.
- [ ] Answering incorrectly ends the quiz with a "refresh to retry" screen.
- [ ] After 5 correct answers, the discount code appears and webhook fires (if URL configured).
- [ ] Discount code is **never** present in HTML/JS source until earned.
- [ ] `correctIndex` values are **never** sent to the browser.
- [ ] Re-entering with the same `sid` after completion shows "already claimed".
- [ ] Page is responsive on mobile.
- [ ] PM2 starts the app and it survives reboot.

## Out of Scope (v1)
- Email collection
- Per-user unique codes
- Shopify OAuth verification
- Persistent database
- Admin dashboard to edit questions
- i18n
