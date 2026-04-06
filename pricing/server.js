const express = require('express');
const app = express();
const PORT = 8082;

const prices = {
  1: 19.99,
  2: 29.99
};

app.get('/health', (req, res) => {
  const requestId = req.header('X-Request-Id') || 'none';
  console.log(`[pricing] requestId=${requestId} path=/health`);
  res.json({ ok: true });
});

app.get('/price/:id', (req, res) => {
  const requestId = req.header('X-Request-Id') || 'none';
  const id = req.params.id;
  console.log(`[pricing] requestId=${requestId} path=/price/${id}`);

  if (!prices[id]) {
    return res.status(404).json({ error: 'price not found', requestId });
  }

  res.json({ productId: Number(id), price: prices[id], requestId });
});

app.listen(PORT, () => {
  console.log(`Pricing listening on ${PORT}`);
});
