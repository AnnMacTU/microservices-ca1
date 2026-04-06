const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = 8081;
const PRICING_URL = process.env.PRICING_URL || 'http://pricing:8082';
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://inventory:8083';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://appuser:apppass@postgres:5432/shopdb';

const pool = new Pool({ connectionString: DATABASE_URL });

async function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

app.get('/health', async (req, res) => {
  res.json({ ok: true });
});

app.post('/checkout', async (req, res) => {
  const requestId = req.header('X-Request-Id') || 'none';
  const { productId, quantity } = req.body;

  console.log(`[checkout] requestId=${requestId} productId=${productId} quantity=${quantity}`);

  try {
    const pricingRes = await fetchWithTimeout(`${PRICING_URL}/price/${productId}`, {
      headers: { 'X-Request-Id': requestId }
    });

    if (!pricingRes.ok) {
      return res.status(502).json({ ok: false, error: 'pricing unavailable', requestId });
    }

    const inventoryRes = await fetchWithTimeout(`${INVENTORY_URL}/stock/${productId}`, {
      headers: { 'X-Request-Id': requestId }
    });

    if (!inventoryRes.ok) {
      return res.status(502).json({ ok: false, error: 'inventory unavailable', requestId });
    }

    const pricing = await pricingRes.json();
    const inventory = await inventoryRes.json();

    if (!inventory.available) {
      return res.status(409).json({ ok: false, error: 'out of stock', requestId });
    }

    const total = Number((pricing.price * quantity).toFixed(2));

    await pool.query(
      'INSERT INTO orders(product_id, quantity, total, request_id) VALUES($1, $2, $3, $4)',
      [productId, quantity, total, requestId]
    );

    res.json({ ok: true, productId, quantity, total, requestId });
  } catch (err) {
    console.error(`[checkout] requestId=${requestId} error=${err.message}`);
    res.status(504).json({ ok: false, error: 'dependency timeout or failure', requestId });
  }
});

app.listen(PORT, () => {
  console.log(`Checkout listening on ${PORT}`);
});
