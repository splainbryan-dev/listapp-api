const pool = require('../db');
const { callClaude } = require('./aiService');

const generateDrafts = async (listingId) => {
  const listingRes = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
  const listing = listingRes.rows[0];
  if (!listing) throw new Error('Listing not found');

  const specificsRes = await pool.query('SELECT key, value FROM listing_specifics WHERE listing_id = $1', [listingId]);
  const specifics = specificsRes.rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});

  const platformRes = await pool.query('SELECT platform FROM listing_platforms WHERE listing_id = $1 AND selected = true', [listingId]);
  const platforms = platformRes.rows.map(r => r.platform);

  const rulesRes = await pool.query('SELECT * FROM platform_rules WHERE platform = ANY($1)', [platforms]);
  const rules = {};
  rulesRes.rows.forEach(r => rules[r.platform] = r);

  await pool.query('DELETE FROM listing_drafts WHERE listing_id = $1', [listingId]);

  const specificsText = Object.entries(specifics)
    .filter(([k]) => !k.startsWith('ebay'))
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const platformTone = {
    facebook: 'casual and friendly, like a neighbor selling on Facebook Marketplace. End with "DM me for info or to arrange pickup."',
    craigslist: 'plain and straightforward, no markdown or formatting. End with "Text or call to arrange viewing."',
    offerup: 'concise and punchy. Lead with the best feature. Keep it scannable.',
    ebay: 'professional and detailed. Use clear sections. Mention condition, what\'s included, and any defects honestly.',
  };

  const drafts = [];

  for (const platform of platforms) {
    const platformRules = rules[platform];
    if (!platformRules) continue;

    const conditionMap = platformRules.condition_map || {};
    const mappedCondition = conditionMap[listing.condition] || listing.condition;
    const titleMax = platformRules.title_max_chars || 80;
    const descMax = platformRules.description_max_chars || 5000;

    const prompt = `You are writing a ${platform} marketplace listing. Tone: ${platformTone[platform] || 'professional and clear'}.

ITEM DATA:
Title: ${listing.title}
Price: $${listing.price}
Condition: ${mappedCondition}
Category: ${listing.category}
Location: ${listing.location || 'Not specified'}
Description: ${listing.description || ''}
${specificsText ? `\nItem Details:\n${specificsText}` : ''}

RULES:
- Title: max ${titleMax} characters
- Description: max ${descMax} characters
- Condition label to use: "${mappedCondition}"

Respond ONLY with a JSON object, no markdown, no extra text:
{
  "title": "optimized title under ${titleMax} chars",
  "description": "full platform-ready description under ${descMax} chars",
  "condition": "${mappedCondition}",
  "category": "best matching category for ${platform}",
  "confidence": 90,
  "issues": []
}

Add to issues array if anything is missing that would hurt listing quality (e.g. "No photos provided", "Location missing").`;

    try {
      const text = await callClaude(prompt);
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const result = await pool.query(
        `INSERT INTO listing_drafts (listing_id, platform, title, description, condition, category, status, issues, ai_confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          listingId, platform,
          (parsed.title || listing.title).slice(0, titleMax),
          (parsed.description || listing.description || '').slice(0, descMax),
          parsed.condition || mappedCondition,
          parsed.category || listing.category,
          parsed.issues?.length ? 'needs_attention' : 'ready',
          JSON.stringify(parsed.issues || []),
          parsed.confidence || 80,
        ]
      );
      drafts.push(result.rows[0]);
    } catch (err) {
      console.error(`Draft generation failed for ${platform}:`, err.message);
      const result = await pool.query(
        `INSERT INTO listing_drafts (listing_id, platform, title, description, condition, category, status, issues, ai_confidence)
         VALUES ($1,$2,$3,$4,$5,$6,'needs_attention',$7,0) RETURNING *`,
        [listingId, platform, listing.title, listing.description, mappedCondition, listing.category, JSON.stringify(['AI generation failed'])]
      );
      drafts.push(result.rows[0]);
    }
  }

  return drafts;
};

module.exports = { generateDrafts };