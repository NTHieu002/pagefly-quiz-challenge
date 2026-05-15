async function postOnce(url, payload, secret) {
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Webhook-Secret'] = secret;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook returned HTTP ${res.status}`);
  }
}

function fireQuizComplete({ sid, discountCode }) {
  const url = process.env.QUIZ_COMPLETE_WEBHOOK_URL;
  if (!url) return;

  const secret = process.env.QUIZ_COMPLETE_WEBHOOK_SECRET || '';
  const payload = {
    sid,
    completedAt: new Date().toISOString(),
    discountCode,
    event: 'quiz-complete',
  };

  (async () => {
    try {
      await postOnce(url, payload, secret);
    } catch (err) {
      console.error('[webhook] first attempt failed:', err.message);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        await postOnce(url, payload, secret);
      } catch (err2) {
        console.error('[webhook] retry failed, giving up:', err2.message);
      }
    }
  })();
}

module.exports = { fireQuizComplete };
