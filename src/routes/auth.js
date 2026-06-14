const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name]
    );
    const user = result.rows[0];
    const token = generateToken(user)
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateToken(user)
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Google OAuth - redirect to Google
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.SERVER_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect(`${process.env.CLIENT_URL}/login?error=cancelled`)

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.SERVER_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      })
    })
    const tokenData = await tokenRes.json()

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const googleUser = await userRes.json()

    // Find or create user in our DB
    let user = await pool.query('SELECT * FROM users WHERE email = $1', [googleUser.email])

    if (user.rows.length === 0) {
      // Create new user
      const newUser = await pool.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [googleUser.email, googleUser.name, 'google_oauth_no_password']
      )
      user = newUser.rows[0]
    } else {
      user = user.rows[0]
    }

    const token = generateToken(user)

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&id=${user.id}`)
  } catch (err) {
    console.error('Google OAuth error:', err)
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`)
  }
})
// X OAuth - redirect to X
router.get('/x', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID,
    redirect_uri: `${process.env.SERVER_URL}/api/auth/x/callback`,
    scope: 'tweet.read users.read offline.access',
    state: 'state123',
    code_challenge: 'challenge',
    code_challenge_method: 'plain',
  })
  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`)
})

// X OAuth callback
router.get('/x/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.redirect(`${process.env.CLIENT_URL}/login?error=cancelled`)

  try {
    const credentials = Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.SERVER_URL}/api/auth/x/callback`,
        code_verifier: 'challenge',
      })
    })
    const tokenData = await tokenRes.json()

    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })
    const xUser = await userRes.json()
    const xData = xUser.data

    let result = await pool.query('SELECT * FROM users WHERE email = $1', [`x_${xData.id}@hubads.app`])
    let user
    if (result.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [`x_${xData.id}@hubads.app`, xData.name, 'x_oauth_no_password']
      )
      user = newUser.rows[0]
    } else {
      user = result.rows[0]
    }

    const token = generateToken(user)
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&id=${user.id}`)
  } catch (err) {
    console.error('X OAuth error:', err)
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`)
  }
})
module.exports = router;
