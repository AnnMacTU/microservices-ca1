const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 8080;
const CHECKOUT_URL = process.env.CHECKOUT_URL || 'http://checkout:8081';

function getRequestId(req) {
  return req.header('X-Request-Id') || crypto.randomUUID();
}

app.get('/api/arch', (req, res) => {
  res.json({ arch: 'gateway-checkout-pricing-inventory-postgres' });
});

app.get('/api/ping', (req, res) => {
  const requestId = getRequestId(req);
  console.log(`[gateway] requestId=${requestId} path=/api/ping`);
  res.set('X-Request-Id', requestId);
  res.json({ ok: true, requestId, ts: new Date().toISOString() });
});

app.post('/api/checkout', async (req, res) => {
  const requestId = getRequestId(req);

  try {
    const r = await fetch(`${CHECKOUT_URL}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId
      },
      body: JSON.stringify(req.body)
    });

    const data = await r.json();
    res.status(r.status).set('X-Request-Id', requestId).json(data);
  } catch (err) {
    console.error(`[gateway] requestId=${requestId} checkout_error=${err.message}`);
    res.status(502).set('X-Request-Id', requestId).json({
      ok: false,
      error: 'checkout unavailable',
      requestId
    });
  }
});

app.listen(PORT, () => {
  console.log(`Gateway listening on ${PORT}`);
});
