const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

const EBAY_AUTH_URL = 'https://auth.sandbox.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
].join(' ');

// Step 1 — redirect user to eBay login (token comes from query string, not headers)
router.get('/connect', (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${process.env.CLIENT_URL}/login?error=session_expired`);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=session_expired`);
  }

  const params = new URLSearchParams({
    client_id: process.env.EBAY_SANDBOX_CLIENT_ID,
    redirect_uri: process.env.EBAY_RU_NAME,
    response_type: 'code',
    scope: SCOPES,
    state: decoded.id.toString(),
  });
  res.redirect(`${EBAY_AUTH_URL}?${params}`);
});

// Step 2 — eBay redirects back here with a code
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect(`${process.env.CLIENT_URL}/settings?error=ebay_cancelled`);

  try {
    const credentials = Buffer.from(
      `${process.env.EBAY_SANDBOX_CLIENT_ID}:${process.env.EBAY_SANDBOX_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch(EBAY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.EBAY_RU_NAME,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('eBay token exchange failed:', tokenData);
      return res.redirect(`${process.env.CLIENT_URL}/settings?error=ebay_failed`);
    }

    const userId = state;

    await pool.query(
      `INSERT INTO user_platforms (user_id, platform, access_token, connected, connected_at)
       VALUES ($1, 'ebay', $2, true, NOW())
       ON CONFLICT (user_id, platform) DO UPDATE SET access_token=$2, connected=true, connected_at=NOW()`,
      [userId, JSON.stringify(tokenData)]
    );

    res.redirect(`${process.env.CLIENT_URL}/settings?success=ebay_connected`);
  } catch (err) {
    console.error('eBay OAuth error:', err);
    res.redirect(`${process.env.CLIENT_URL}/settings?error=ebay_failed`);
  }
});

module.exports = router;