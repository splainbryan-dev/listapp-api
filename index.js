require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const authRoutes = require('./src/routes/auth');
const listingRoutes = require('./src/routes/listings');
const draftRoutes = require('./src/routes/drafts');
const aiRoutes = require('./src/routes/ai');
const ebayAuthRoutes = require('./src/routes/ebayAuth');
const pool = require('./src/db');

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'https://listapp-client.vercel.app',
      'https://hubads.netlify.app'
    ]
    if (!origin || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ebay-auth', ebayAuthRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// eBay Marketplace Account Deletion endpoint
app.get('/api/ebay/deletion', (req, res) => {
  const { challenge_code } = req.query;
  if (!challenge_code) return res.status(400).json({ error: 'Missing challenge_code' });
  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
  const endpoint = 'https://listapp-api-production.up.railway.app/api/ebay/deletion';
  const hash = crypto.createHash('sha256')
    .update(challenge_code + verificationToken + endpoint)
    .digest('hex');
  res.json({ challengeResponse: hash });
});

app.post('/api/ebay/deletion', async (req, res) => {
  try {
    console.log('eBay deletion request:', JSON.stringify(req.body));
    // TODO: handle actual deletion when we know the payload structure
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('eBay deletion error:', err);
    res.status(200).json({ success: true }); // always 200 to eBay
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));