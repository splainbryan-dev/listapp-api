require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const listingRoutes = require('./src/routes/listings');
const draftRoutes = require('./src/routes/drafts');
const aiRoutes = require('./src/routes/ai');
const platformRoutes = require('./src/routes/platforms');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/platforms', platformRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
