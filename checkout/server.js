const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = 8081;
const PRICING_URL = process.env.PRICING_URL || 'http://pricing:8082';
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://inventory:8083';
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://appuser:apppass@postgres:5432/shopdb';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      total NUMERIC NOT NULL,
      request_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('[checkout] orders table ready');
}

function getRequestId(req) {
  return req.header('X-Request-Id') || 'none';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/health', async (req, res) => {
  const requestId = getRequestId(req);
  console.log(`[checkout] requestId=${requestId} path=/health`);

  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'checkout' });
  } catch (err) {
    console.error(`[checkout] requestId=${requestId} db_health_error=${err.message}`);
    res.status(500).json({ ok: false, error: 'database unavailable', requestId });
  }
});

app.post('/checkout', async (req, res) => {
  const requestId = getRequestId(req);
  const { productId, quantity } = req.body;

  console.log(
    `[checkout] requestId=${requestId} path=/checkout productId=${productId} quantity=${quantity}`
  );

  if (!productId || !quantity) {
    return res.status(400).json({
      ok: false,
      error: 'productId and quantity are required',
      requestId,
    });
  }

  try {
    const pricingRes = await fetchWithTimeout(`${PRICING_URL}/price/${productId}`, {
      method: 'GET',
      headers: {
        'X-Request-Id': requestId,
      },
    });

    if (!pricingRes.ok) {
      console.error(
        `[checkout] requestId=${requestId} pricing_status=${pricingRes.status}`
      );
      return res.status(502).json({
        ok: false,
        error: 'pricing unavailable',
        requestId,
      });
    }

    const inventoryRes = await fetchWithTimeout(`${INVENTORY_URL}/stock/${productId}`, {
      method: 'GET',
      headers: {
        'X-Request-Id': requestId,
      },
    });

    if (!inventoryRes.ok) {
      console.error(
        `[checkout] requestId=${requestId} inventory_status=${inventoryRes.status}`
      );
      return res.status(502).json({
        ok: false,
        error: 'inventory unavailable',
        requestId,
      });
    }

    const pricing = await pricingRes.json();
    const inventory = await inventoryRes.json();

    if (!inventory.available) {
      console.error(`[checkout] requestId=${requestId} inventory_unavailable=true`);
      return res.status(409).json({
        ok: false,
        error: 'out of stock',
        requestId,
      });
    }

    const total = Number((pricing.price * quantity).toFixed(2));

    await pool.query(
      `INSERT INTO orders (product_id, quantity, total, request_id)
       VALUES ($1, $2, $3, $4)`,
      [productId, quantity, total, requestId]
    );

    console.log(
      `[checkout] requestId=${requestId} checkout_success=true total=${total}`
    );

    return res.json({
      ok: true,
      productId,
      quantity,
      total,
      requestId,
    });
  } catch (err) {
    const isTimeout = err.name === 'AbortError';

    console.error(
      `[checkout] requestId=${requestId} checkout_error=${err.message} timeout=${isTimeout}`
    );

    return res.status(504).json({
      ok: false,
      error: isTimeout ? 'dependency timeout' : 'dependency failure',
      requestId,
    });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[checkout] listening on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(`[checkout] startup_failed=${err.message}`);
    process.exit(1);
  });
