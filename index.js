require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./src/routes/auth');
const listingRoutes = require('./src/routes/listings');
const draftRoutes = require('./src/routes/drafts');
const aiRoutes = require('./src/routes/ai');
const ebayAuthRoutes = require('./src/routes/ebayAuth');

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));