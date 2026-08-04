(function () {
  const state = window.__QUIZ__ || {};
  const card = document.getElementById('quiz-card');
  const progress = document.getElementById('progress');
  const intro = document.getElementById('intro');

  let currentQuestion = state.firstQuestion;
  let currentIndex = state.firstIndex || 0;
  const total = state.total || 5;
  const timePerQuestion = state.timePerQuestion || 20;

  let timerInterval = null;
  let timeLeft = timePerQuestion;
  let busy = false;

  const RATING_WEBHOOK_URL = 'https://workflow.bravebits.co/webhook/rating_pf_service';
  const REDIRECT_SECONDS = 3;

  function setProgress(idx) {
    if (idx === null || idx === undefined) {
      progress.style.display = 'none';
      progress.textContent = '';
    } else {
      progress.style.display = '';
      progress.textContent = `Question ${idx + 1} of ${total}`;
    }
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `0:${String(s).padStart(2, '0')}`;
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startTimer() {
    stopTimer();
    timeLeft = timePerQuestion;
    updateTimerUI();

    const startedAt = Date.now();
    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      timeLeft = timePerQuestion - elapsed;
      updateTimerUI();
      if (timeLeft <= 0) {
        stopTimer();
        handleTimeout();
      }
    }, 100);
  }

  function updateTimerUI() {
    const text = document.getElementById('timer-text');
    const fill = document.getElementById('timer-fill');
    if (!text || !fill) return;
    text.textContent = formatTime(timeLeft);
    const pct = Math.max(0, (timeLeft / timePerQuestion) * 100);
    fill.style.width = pct + '%';
    if (timeLeft <= 5) {
      text.classList.add('is-warning');
      fill.classList.add('is-warning');
    } else {
      text.classList.remove('is-warning');
      fill.classList.remove('is-warning');
    }
  }

  function renderQuestion(q, idx) {
    setProgress(idx);
    const optionsHtml = q.options
      .map((opt, i) =>
        `<button type="button" class="option" data-index="${i}">
          <span class="option-letter">${String.fromCharCode(65 + i)}</span>
          <span class="option-text">${escapeHtml(opt)}</span>
        </button>`
      )
      .join('');

    card.innerHTML = `
      <div class="fade-in">
        <div class="timer-wrap">
          <div class="timer-row">
            <span class="timer-text" id="timer-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/></svg>
              ${formatTime(timePerQuestion)}
            </span>
            <span class="text-xs text-muted-light">Time left</span>
          </div>
          <div class="timer-bar"><div id="timer-fill" class="timer-fill"></div></div>
        </div>

        <h2 class="text-xl sm:text-2xl font-semibold mb-5 tracking-tight">${escapeHtml(q.question)}</h2>
        <div id="options">${optionsHtml}</div>
        <div id="feedback" class="mt-4 text-sm font-medium"></div>
      </div>
    `;

    card.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (busy) return;
        submitAnswer(parseInt(btn.dataset.index, 10), btn);
      });
    });

    busy = false;
    startTimer();
  }

  async function submitAnswer(selectedIndex, btn) {
    if (busy) return;
    busy = true;
    stopTimer();

    const buttons = card.querySelectorAll('.option');
    buttons.forEach((b) => (b.disabled = true));
    const feedback = document.getElementById('feedback');

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid: state.sid,
          questionId: currentQuestion.id,
          selectedIndex,
        }),
      });
      const data = await res.json();

      if (data.alreadyClaimed) {
        renderAlreadyClaimed(data.discountCode);
        return;
      }

      if (!data.correct) {
        if (btn) btn.classList.add('is-wrong');
        if (feedback) feedback.innerHTML = '<span style="color:var(--pf-danger)">Wrong answer.</span>';
        setTimeout(() => renderGameOver('wrong'), 600);
        return;
      }

      if (btn) btn.classList.add('is-correct');
      if (feedback) feedback.innerHTML = '<span style="color:var(--pf-success)">Correct!</span>';

      if (data.completed) {
        setTimeout(() => renderSuccess(data.discountCode, data.discountLabel), 800);
        return;
      }

      setTimeout(() => {
        currentQuestion = data.nextQuestion;
        currentIndex = data.nextIndex;
        renderQuestion(currentQuestion, currentIndex);
      }, 800);
    } catch (err) {
      if (feedback) feedback.innerHTML = '<span style="color:var(--pf-danger)">Network error. Please refresh.</span>';
      buttons.forEach((b) => (b.disabled = false));
      busy = false;
    }
  }

  function handleTimeout() {
    if (busy) return;
    busy = true;
    const buttons = card.querySelectorAll('.option');
    buttons.forEach((b) => (b.disabled = true));

    // Submit a deliberately invalid selection so the server resets state too.
    fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sid: state.sid,
        questionId: currentQuestion.id,
        selectedIndex: -1,
      }),
    }).catch(() => {});

    renderGameOver('timeout');
  }

  function renderGameOver(reason) {
    stopTimer();
    if (intro) intro.style.display = 'none';
    setProgress(null);

    const heading = reason === 'timeout' ? 'Time\'s up!' : 'Wrong answer';
    const sub = reason === 'timeout'
      ? 'You ran out of time. Refresh the page to start over.'
      : 'Game over. Refresh the page to start over and try again.';

    card.innerHTML = `
      <div class="fade-in text-center py-6">
        <div class="text-5xl mb-3">${reason === 'timeout' ? '⏱️' : '😕'}</div>
        <h2 class="text-2xl font-semibold mb-2 tracking-tight">${heading}</h2>
        <p class="text-muted mb-6">${sub}</p>
        <button type="button" id="refresh-btn" class="btn-primary">Refresh to try again</button>
      </div>
    `;
    document.getElementById('refresh-btn').addEventListener('click', () => location.reload());
  }

  function renderSuccess(code, label) {
    const rewardLabel = label || state.discountLabel || '20% off';
    stopTimer();
    if (intro) intro.style.display = 'none';
    setProgress(null);
    card.innerHTML = `
      <div class="fade-in text-center py-6">
        <div class="text-5xl mb-3 pulse-once">🎉</div>
        <h2 class="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">You did it!</h2>
        <p class="text-muted mb-6">Here's your <span class="font-semibold" style="color:var(--pf-secondary)">${escapeHtml(rewardLabel)}</span> discount code:</p>
        ${renderCodeCta(code)}
        <p class="text-muted text-sm mt-6">Use this code at checkout to get ${escapeHtml(rewardLabel)}.</p>
      </div>
    `;
    bindCodeCta(code);

    if (typeof confetti === 'function') {
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#535af7', '#5f66ff', '#a6acff', '#f0f2ff'] });
      setTimeout(() => confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 }, colors: ['#535af7', '#a6acff', '#ffffff'] }), 350);
    }
  }

  function renderAlreadyClaimed(code) {
    stopTimer();
    if (intro) intro.style.display = 'none';
    setProgress(null);
    card.innerHTML = `
      <div class="fade-in text-center py-6">
        <div class="text-5xl mb-3">✅</div>
        <h2 class="text-2xl font-semibold mb-2 tracking-tight">You've already claimed your discount</h2>
        <p class="text-muted mb-6">Here's your code again:</p>
        ${renderCodeCta(code)}
      </div>
    `;
    bindCodeCta(code);
  }

  function ctaRedirect() {
    // A reward-specific redirect (e.g. u1m → App Store) wins over the shop
    // pricing deep-link; falls back to plain copy when neither is set.
    if (state.rewardRedirectUrl) return { url: state.rewardRedirectUrl, label: 'PageFly' };
    if (state.shopifyPricingUrl) return { url: state.shopifyPricingUrl, label: 'the PageFly pricing page' };
    return null;
  }

  // Fire-and-forget rating ping. no-cors keeps it opaque (no preflight, no CORS
  // error) since we only care that the request leaves the browser.
  // Reports the campaign token from ?code=, not the discount code on screen —
  // an unknown ?code= falls back to the default reward, so the two differ.
  function pingRatingWebhook() {
    const url = `${RATING_WEBHOOK_URL}?code=${encodeURIComponent(state.urlCode || '')}&type=pro1&option=yes`;
    try {
      fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', keepalive: true })
        .catch(() => { /* ignore — the ping is best-effort */ });
    } catch (_) { /* ignore */ }
  }

  function renderCodeCta(code) {
    const sub = ctaRedirect() ? 'Click to copy & continue →' : 'Click to copy';
    return `
      <div class="flex flex-col items-center">
        <button type="button" id="code-cta" class="code-cta" aria-label="Copy discount code">
          <span class="code-cta-code">${escapeHtml(code || '')}</span>
          <span class="code-cta-sub" id="code-cta-sub">${sub}</span>
        </button>
        <p class="code-expiry">This code is valid for <span class="font-semibold">24 hours</span>.</p>
        <p id="redirect-note" class="redirect-note" aria-live="polite" hidden></p>
      </div>
    `;
  }

  function startRedirectCountdown(target) {
    const note = document.getElementById('redirect-note');
    let left = REDIRECT_SECONDS;

    const paint = () => {
      if (!note) return;
      note.hidden = false;
      note.innerHTML = `Taking you to ${escapeHtml(target.label)} in <span class="countdown-num">${left}</span>s…`;
    };

    paint();
    const id = setInterval(() => {
      left -= 1;
      paint();
      if (left <= 0) {
        clearInterval(id);
        window.location.href = target.url;
      }
    }, 1000);
  }

  function bindCodeCta(code) {
    const btn = document.getElementById('code-cta');
    if (!btn) return;
    const sub = document.getElementById('code-cta-sub');
    let counting = false;

    btn.addEventListener('click', async () => {
      if (counting) return;
      try {
        await navigator.clipboard.writeText(code || '');
      } catch (_) { /* ignore — still ping & navigate */ }
      if (sub) sub.textContent = 'Copied!';

      pingRatingWebhook();

      const target = ctaRedirect();
      if (!target) {
        if (sub) setTimeout(() => { sub.textContent = 'Click to copy'; }, 1800);
        return;
      }
      counting = true;
      startRedirectCountdown(target);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  if (state.alreadyClaimed) {
    renderAlreadyClaimed(state.discountCode);
  } else if (currentQuestion) {
    renderQuestion(currentQuestion, currentIndex);
  } else {
    card.innerHTML = '<p class="text-center text-muted">Unable to load the quiz.</p>';
  }
})();
