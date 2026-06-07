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

// AI suggest category from title
router.post('/suggest-category', auth, async (req, res) => {
  const { title } = req.body
  if (!title) return res.status(400).json({ error: 'Title required' })

  const categories = ['vehicles','electronics','furniture','clothing','tools','appliances','sports','gaming','garden','collectibles','kids','general']

  try {
    const { callClaude } = require('../services/aiService')
    const prompt = `Given this item listing title: "${title}"

Which category does it belong to? Choose EXACTLY ONE from this list:
vehicles, electronics, furniture, clothing, tools, appliances, sports, gaming, garden, collectibles, kids, general

Reply with ONLY the category id, nothing else.`

    const result = await callClaude(prompt)
    const categoryId = result.trim().toLowerCase().replace(/[^a-z]/g, '')
    const matched = categories.find(c => categoryId.includes(c)) || 'general'
    
    res.json({ categoryId: matched })
  } catch (err) {
    res.json({ categoryId: 'general' })
  }
})
