const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../db');
const { shortenTitle, rewriteDescription } = require('../services/aiService');
const router = express.Router();

// AI shorten title for a draft
router.post('/shorten-title/:draftId', auth, async (req, res) => {
  try {
    const draftRes = await pool.query('SELECT * FROM listing_drafts WHERE id = $1', [req.params.draftId]);
    const draft = draftRes.rows[0];
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    const rulesRes = await pool.query('SELECT * FROM platform_rules WHERE platform = $1', [draft.platform]);
    const rules = rulesRes.rows[0];

    const shortened = await shortenTitle(draft.title, rules.title_max_chars);

    // Update draft
    await pool.query('UPDATE listing_drafts SET title=$1, updated_at=NOW() WHERE id=$2', [shortened.trim(), draft.id]);

    res.json({ title: shortened.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI rewrite description for a draft
router.post('/rewrite-description/:draftId', auth, async (req, res) => {
  try {
    const draftRes = await pool.query('SELECT * FROM listing_drafts WHERE id = $1', [req.params.draftId]);
    const draft = draftRes.rows[0];
    if (!draft) return res.status(404).json({ error: 'Draft not found' });

    const rulesRes = await pool.query('SELECT * FROM platform_rules WHERE platform = $1', [draft.platform]);
    const rules = rulesRes.rows[0];

    const rewritten = await rewriteDescription(draft.description, draft.platform, rules.description_max_chars);

    await pool.query('UPDATE listing_drafts SET description=$1, updated_at=NOW() WHERE id=$2', [rewritten.trim(), draft.id]);

    res.json({ description: rewritten.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
