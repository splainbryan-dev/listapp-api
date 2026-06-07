const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { generateDrafts } = require('../services/draftService');
const router = express.Router();

// Generate drafts for a listing
router.post('/generate/:listingId', auth, async (req, res) => {
  try {
    const drafts = await generateDrafts(req.params.listingId);
    res.json(drafts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all drafts for a listing
router.get('/:listingId', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM listing_drafts WHERE listing_id = $1', [req.params.listingId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a draft (after user edits)
router.put('/:id', auth, async (req, res) => {
  const { title, description, condition, category, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE listing_drafts SET title=$1, description=$2, condition=$3, category=$4, status=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [title, description, condition, category, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
