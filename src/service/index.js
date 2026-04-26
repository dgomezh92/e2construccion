const express = require('express');
const app = express();
app.use(express.json());

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.post('/payments', (req, res) => {
  const { amount, currency, merchantId } = req.body;
  if (!amount || !currency || !merchantId) {
    return res.status(400).json({ error: 'invalid payload' });
  }

  const transactionId = `txn_${Date.now()}`;
  return res.status(201).json({
    status: 'authorized',
    transactionId,
    amount,
    currency,
    merchantId,
  });
});

app.listen(3000, () => {
  console.log('Payment gateway service started on port 3000');
});
