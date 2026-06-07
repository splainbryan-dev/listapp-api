const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all listings for user
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM listings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single listing with photos, specifics, platforms
router.get('/:id', auth, async (req, res) => {
  try {
    const listing = await pool.query('SELECT * FROM listings WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!listing.rows[0]) return res.status(404).json({ error: 'Not found' });

    const photos = await pool.query('SELECT * FROM listing_photos WHERE listing_id = $1 ORDER BY order_index', [req.params.id]);
    const specifics = await pool.query('SELECT * FROM listing_specifics WHERE listing_id = $1', [req.params.id]);
    const platforms = await pool.query('SELECT * FROM listing_platforms WHERE listing_id = $1', [req.params.id]);

    res.json({ ...listing.rows[0], photos: photos.rows, specifics: specifics.rows, platforms: platforms.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create listing
router.post('/', auth, async (req, res) => {
  const { title, description, price, condition, category, location, pickup_only, shipping_policy, platforms, specifics } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO listings (user_id, title, description, price, condition, category, location, pickup_only, shipping_policy)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, title, description, price, condition, category, location, pickup_only, shipping_policy]
    );
    const listing = result.rows[0];

    // Save selected platforms
    if (platforms?.length) {
      for (const platform of platforms) {
        await pool.query('INSERT INTO listing_platforms (listing_id, platform) VALUES ($1, $2)', [listing.id, platform]);
      }
    }

    // Save item specifics
    if (specifics?.length) {
      for (const s of specifics) {
        await pool.query('INSERT INTO listing_specifics (listing_id, key, value) VALUES ($1, $2, $3)', [listing.id, s.key, s.value]);
      }
    }

    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update listing
router.put('/:id', auth, async (req, res) => {
  const { title, description, price, condition, category, location, pickup_only, shipping_policy } = req.body;
  try {
    const result = await pool.query(
      `UPDATE listings SET title=$1, description=$2, price=$3, condition=$4, category=$5,
       location=$6, pickup_only=$7, shipping_policy=$8, updated_at=NOW()
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [title, description, price, condition, category, location, pickup_only, shipping_policy, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete listing
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM listings WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
