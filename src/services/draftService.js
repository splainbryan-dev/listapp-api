const pool = require('../db');
const { detectIssues } = require('./aiService');

const generateDrafts = async (listingId) => {
  // Get the master listing
  const listingRes = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
  const listing = listingRes.rows[0];
  if (!listing) throw new Error('Listing not found');

  // Get selected platforms for this listing
  const platformRes = await pool.query('SELECT platform FROM listing_platforms WHERE listing_id = $1 AND selected = true', [listingId]);
  const platforms = platformRes.rows.map(r => r.platform);

  // Get platform rules
  const rulesRes = await pool.query('SELECT * FROM platform_rules WHERE platform = ANY($1)', [platforms]);
  const rules = {};
  rulesRes.rows.forEach(r => rules[r.platform] = r);

  // Delete existing drafts and regenerate
  await pool.query('DELETE FROM listing_drafts WHERE listing_id = $1', [listingId]);

  const drafts = [];

  for (const platform of platforms) {
    const platformRules = rules[platform];
    if (!platformRules) continue;

    // Map condition using platform rules
    const conditionMap = platformRules.condition_map || {};
    const mappedCondition = conditionMap[listing.condition] || listing.condition;

    // Build draft (title/description start as master, issues flag what needs fixing)
    const draft = {
      listing_id: listingId,
      platform,
      title: listing.title,
      description: listing.description,
      condition: mappedCondition,
      category: listing.category,
      status: 'pending',
      issues: [],
      ai_confidence: 100
    };

    // Detect issues
    draft.issues = await detectIssues(draft, platformRules);
    draft.status = draft.issues.length === 0 ? 'ready' : 'needs_attention';
    if (draft.issues.length > 0) draft.ai_confidence = Math.max(0, 100 - (draft.issues.length * 20));

    // Save draft
    const result = await pool.query(
      `INSERT INTO listing_drafts (listing_id, platform, title, description, condition, category, status, issues, ai_confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [draft.listing_id, draft.platform, draft.title, draft.description, draft.condition, draft.category, draft.status, JSON.stringify(draft.issues), draft.ai_confidence]
    );
    drafts.push(result.rows[0]);
  }

  return drafts;
};

module.exports = { generateDrafts };
