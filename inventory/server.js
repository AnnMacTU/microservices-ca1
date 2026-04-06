const express = require('express');
const app = express();
const PORT = 8083;

const stock = {
  1: true,
  2: true
};

app.get('/health', (req, res) => {
  const requestId = req.header('X-Request-Id') || 'none';
  console.log(`[inventory] requestId=${requestId} path=/health`);
  res.json({ ok: true });
});

app.get('/stock/:id', (req, res) => {
  const requestId = req.header('X-Request-Id') || 'none';
  const id = req.params.id;
  console.log(`[inventory] requestId=${requestId} path=/stock/${id}`);

  if (!(id in stock)) {
    return res.status(404).json({ error: 'stock not found', requestId });
  }

  res.json({ productId: Number(id), available: stock[id], requestId });
});

app.listen(PORT, () => {
  console.log(`Inventory listening on ${PORT}`);
});
