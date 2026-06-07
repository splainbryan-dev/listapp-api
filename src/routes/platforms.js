const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Get user's connected platforms
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_platforms WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Connect a platform
router.post('/connect', auth, async (req, res) => {
  const { platform, username, access_token } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO user_platforms (user_id, platform, username, access_token)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, platform) DO UPDATE SET username=$3, access_token=$4, connected=true
       RETURNING *`,
      [req.user.id, platform, username, access_token]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Disconnect a platform
router.patch('/disconnect/:platform', auth, async (req, res) => {
  try {
    await pool.query('UPDATE user_platforms SET connected=false WHERE user_id=$1 AND platform=$2', [req.user.id, req.params.platform]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
