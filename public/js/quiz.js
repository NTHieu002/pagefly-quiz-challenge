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
            <span class="text-xs text-slate-400">Time left</span>
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
        setTimeout(() => renderSuccess(data.discountCode), 800);
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
        <p class="text-slate-600 mb-6">${sub}</p>
        <button type="button" id="refresh-btn" class="btn-primary">Refresh to try again</button>
      </div>
    `;
    document.getElementById('refresh-btn').addEventListener('click', () => location.reload());
  }

  function renderSuccess(code) {
    stopTimer();
    if (intro) intro.style.display = 'none';
    setProgress(null);
    card.innerHTML = `
      <div class="fade-in text-center py-6">
        <div class="text-5xl mb-3 pulse-once">🎉</div>
        <h2 class="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">You did it!</h2>
        <p class="text-slate-600 mb-6">Here's your <span class="font-semibold" style="color:var(--pf-primary)">20% off</span> discount code:</p>
        ${renderCodeCta(code)}
        <p class="text-slate-500 text-sm mt-6">Use this code at checkout to get 20% off.</p>
      </div>
    `;
    bindCodeCta(code);

    if (typeof confetti === 'function') {
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#4a4cf6', '#6366f1', '#a5b4fc', '#ffffff'] });
      setTimeout(() => confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 }, colors: ['#4a4cf6', '#818cf8', '#ffffff'] }), 350);
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
        <p class="text-slate-600 mb-6">Here's your code again:</p>
        ${renderCodeCta(code)}
      </div>
    `;
    bindCodeCta(code);
  }

  function renderCodeCta(code) {
    const hasShop = !!state.shopifyAdminUrl;
    const sub = hasShop ? 'Click to copy & back to PageFly →' : 'Click to copy';
    return `
      <div class="flex flex-col items-center">
        <button type="button" id="code-cta" class="code-cta" aria-label="Copy discount code">
          <span class="code-cta-code">${escapeHtml(code || '')}</span>
          <span class="code-cta-sub" id="code-cta-sub">${sub}</span>
        </button>
      </div>
    `;
  }

  function bindCodeCta(code) {
    const btn = document.getElementById('code-cta');
    if (!btn) return;
    const sub = document.getElementById('code-cta-sub');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code || '');
      } catch (_) { /* ignore — still navigate */ }

      if (state.shopifyAdminUrl) {
        if (sub) sub.textContent = 'Copied! Returning to PageFly…';
        setTimeout(() => { window.location.href = state.shopifyAdminUrl; }, 450);
      } else if (sub) {
        sub.textContent = 'Copied!';
        setTimeout(() => { sub.textContent = 'Click to copy'; }, 1800);
      }
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
    card.innerHTML = '<p class="text-center text-slate-600">Unable to load the quiz.</p>';
  }
})();
