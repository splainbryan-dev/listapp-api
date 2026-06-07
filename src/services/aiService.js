const https = require('https');

const callClaude = (prompt) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content[0].text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

// Shorten title to fit within char limit
const shortenTitle = async (title, maxChars) => {
  const prompt = `Shorten this listing title to ${maxChars} characters or less. Keep the most important keywords. Return ONLY the shortened title, nothing else.\n\nTitle: ${title}`;
  return await callClaude(prompt);
};

// Rewrite description for a specific platform
const rewriteDescription = async (description, platform, maxChars) => {
  const prompt = `Rewrite this listing description for ${platform} marketplace. Keep it under ${maxChars} characters. Match the tone of ${platform} sellers. Return ONLY the rewritten description, nothing else.\n\nDescription: ${description}`;
  return await callClaude(prompt);
};

// Detect issues in a draft
const detectIssues = async (draft, platformRules) => {
  const issues = [];

  if (draft.title && draft.title.length > platformRules.title_max_chars) {
    issues.push({ type: 'title_too_long', message: `Title exceeds ${platformRules.title_max_chars} character limit`, field: 'title' });
  }

  if (draft.description && draft.description.length > platformRules.description_max_chars) {
    issues.push({ type: 'description_too_long', message: `Description exceeds ${platformRules.description_max_chars} character limit`, field: 'description' });
  }

  if (!draft.category) {
    issues.push({ type: 'missing_category', message: 'Category not mapped for this platform', field: 'category' });
  }

  return issues;
};

module.exports = { callClaude, shortenTitle, rewriteDescription, detectIssues };
