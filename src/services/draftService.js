const pool = require('../db');

// ─── Platform-specific templates ────────────────────────────────────────────

const buildDescription = (listing, specifics, platform) => {
  const s = specifics;
  const price = listing.price ? `$${parseFloat(listing.price).toLocaleString()}` : '';
  const location = listing.location || '';
  const condition = listing.condition || '';

  // Build item detail lines from specifics (exclude eBay-specific fields)
  const detailLines = Object.entries(s)
    .filter(([k]) => !k.startsWith('ebay') && s[k])
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
      return `${label}: ${v}`
    })

  const details = detailLines.join('\n')
  const baseDesc = listing.description || ''

  switch (platform) {

    case 'facebook': {
      const lines = [
        `${listing.title} — ${price}`,
        '',
        condition ? `Condition: ${condition}` : '',
        details,
        baseDesc ? `\n${baseDesc}` : '',
        '',
        location ? `📍 ${location}` : '',
        '',
        'DM me for more info or to arrange pickup!',
      ].filter(l => l !== null)
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    case 'craigslist': {
      const lines = [
        listing.title,
        `Asking: ${price}`,
        condition ? `Condition: ${condition}` : '',
        '',
        details,
        baseDesc ? `\n${baseDesc}` : '',
        '',
        location ? `Location: ${location}` : '',
        'Text or call to arrange viewing.',
      ].filter(l => l !== null)
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    case 'offerup': {
      const highlight = detailLines[0] || condition
      const rest = detailLines.slice(1).join(' · ')
      const lines = [
        highlight ? `${highlight} · ${price}` : price,
        rest,
        baseDesc,
        location ? `📍 ${location}` : '',
      ].filter(Boolean)
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    case 'nextdoor': {
      const neighborhood = location ? `in ${location}` : 'in the neighborhood'
      const lines = [
        `Hey neighbors! Selling my ${listing.title} ${neighborhood}.`,
        '',
        condition ? `Condition: ${condition}` : '',
        details,
        baseDesc ? `\n${baseDesc}` : '',
        '',
        `Asking ${price}. Local pickup preferred.`,
        'Feel free to message me with any questions!',
      ].filter(l => l !== null)
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    case 'ebay': {
      const shippingInfo = s.ebayShipping
        ? `Shipping: ${s.ebayShipping}${s.ebayShippingCost ? ` ($${s.ebayShippingCost})` : ''}`
        : ''
      const returnsInfo = s.ebayReturns ? `Returns: ${s.ebayReturns}` : ''
      const handlingInfo = s.ebayHandling ? `Handling Time: ${s.ebayHandling}` : ''

      const lines = [
        `ITEM DESCRIPTION`,
        '─────────────────',
        listing.title,
        '',
        condition ? `Condition: ${condition}` : '',
        details,
        baseDesc ? `\nAbout this item:\n${baseDesc}` : '',
        '',
        shippingInfo || returnsInfo || handlingInfo ? 'SHIPPING & RETURNS\n─────────────────' : '',
        shippingInfo,
        returnsInfo,
        handlingInfo,
        location ? `\nShips from: ${location}` : '',
        '',
        'Thank you for viewing this listing. Please message with any questions before purchasing.',
      ].filter(l => l !== null)
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    default: {
      return [listing.title, condition, details, baseDesc, location].filter(Boolean).join('\n')
    }
  }
}

const buildTitle = (listing, platform) => {
  const limits = { facebook: 100, craigslist: 70, offerup: 100, nextdoor: 100, ebay: 80 }
  const max = limits[platform] || 80
  return listing.title.slice(0, max)
}

const mapCondition = (condition, platform) => {
  const maps = {
    facebook:   { New: 'New', 'Like New': 'Like New', Good: 'Good', Fair: 'Fair', Poor: 'Poor' },
    craigslist: { New: 'new', 'Like New': 'like new', Good: 'good', Fair: 'fair', Poor: 'parts only' },
    offerup:    { New: 'New', 'Like New': 'Like New', Good: 'Good', Fair: 'Fair', Poor: 'Poor' },
    nextdoor:   { New: 'New', 'Like New': 'Like New', Good: 'Good', Fair: 'Fair', Poor: 'Poor' },
    ebay:       { New: 'New', 'Like New': 'Like New', Good: 'Good', Fair: 'Acceptable', Poor: 'For parts or not working' },
  }
  return maps[platform]?.[condition] || condition
}

const checkIssues = (listing, specifics) => {
  const issues = []
  if (!listing.location) issues.push('No location set — adds trust and helps local buyers find you')
  if (!listing.description) issues.push('No description — more detail helps items sell faster')
  if (!specifics || Object.keys(specifics).length === 0) issues.push('No item specifics — fill in details for better results')
  return issues
}

const mapCategory = (category, platform) => {
  const maps = {
    ebay: {
      vehicles: 'eBay Motors',
      electronics: 'Consumer Electronics',
      furniture: 'Home & Garden',
      clothing: 'Clothing, Shoes & Accessories',
      tools: 'Home Improvement',
      appliances: 'Home & Garden',
      sports: 'Sporting Goods',
      gaming: 'Video Games & Consoles',
      garden: 'Home & Garden',
      collectibles: 'Collectibles',
      kids: 'Baby & Kids',
      general: 'Everything Else',
    }
  }
  return maps[platform]?.[category] || category || 'General'
}

// ─── Main export ─────────────────────────────────────────────────────────────

const generateDrafts = async (listingId) => {
  const listingRes = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId])
  const listing = listingRes.rows[0]
  if (!listing) throw new Error('Listing not found')

  const specificsRes = await pool.query('SELECT key, value FROM listing_specifics WHERE listing_id = $1', [listingId])
  const specifics = specificsRes.rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {})

  const platformRes = await pool.query('SELECT platform FROM listing_platforms WHERE listing_id = $1', [listingId])
  const platforms = platformRes.rows.map(r => r.platform)

  await pool.query('DELETE FROM listing_drafts WHERE listing_id = $1', [listingId])

  const issues = checkIssues(listing, specifics)
  const drafts = []

  for (const platform of platforms) {
    const title = buildTitle(listing, platform)
    const description = buildDescription(listing, specifics, platform)
    const condition = mapCondition(listing.condition, platform)
    const category = mapCategory(listing.category, platform)
    const status = issues.length ? 'needs_attention' : 'ready'

    const result = await pool.query(
      `INSERT INTO listing_drafts (listing_id, platform, title, description, condition, category, status, issues, ai_confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [listingId, platform, title, description, condition, category, status, JSON.stringify(issues), 85]
    )
    drafts.push(result.rows[0])
  }

  return drafts
}

module.exports = { generateDrafts }