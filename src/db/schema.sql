-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User defaults (location, shipping set once)
CREATE TABLE IF NOT EXISTS user_defaults (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  default_location TEXT,
  default_pickup_only BOOLEAN DEFAULT true,
  default_shipping_policy TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Connected platform accounts
CREATE TABLE IF NOT EXISTS user_platforms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT,
  username TEXT,
  connected BOOLEAN DEFAULT true,
  connected_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Master listings (created once)
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  condition TEXT, -- new, like_new, good, fair, poor
  category TEXT,
  location TEXT,
  pickup_only BOOLEAN DEFAULT true,
  shipping_policy TEXT,
  status TEXT DEFAULT 'draft', -- draft, active, sold
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Photos per listing
CREATE TABLE IF NOT EXISTS listing_photos (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- Item specifics (dynamic key/value per listing)
CREATE TABLE IF NOT EXISTS listing_specifics (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);

-- Which platforms each listing targets
CREATE TABLE IF NOT EXISTS listing_platforms (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  selected BOOLEAN DEFAULT true
);

-- Platform-specific drafts (AI generated)
CREATE TABLE IF NOT EXISTS listing_drafts (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  title TEXT,
  description TEXT,
  condition TEXT,
  category TEXT,
  status TEXT DEFAULT 'pending', -- pending, ready, needs_attention, published
  issues JSONB DEFAULT '[]',
  ai_confidence INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform rules (title/description limits, condition mapping)
CREATE TABLE IF NOT EXISTS platform_rules (
  id SERIAL PRIMARY KEY,
  platform TEXT UNIQUE NOT NULL,
  title_max_chars INTEGER,
  description_max_chars INTEGER,
  condition_map JSONB,
  category_map JSONB
);

-- Seed platform rules
INSERT INTO platform_rules (platform, title_max_chars, description_max_chars, condition_map)
VALUES
  ('craigslist', 70, 5000, '{"new":"new","like_new":"like new","good":"good","fair":"fair","poor":"parts only"}'),
  ('ebay', 80, 50000, '{"new":"New","like_new":"Like New","good":"Good","fair":"Acceptable","poor":"For parts or not working"}'),
  ('facebook', 100, 5000, '{"new":"New","like_new":"Like New","good":"Good","fair":"Fair","poor":"Poor"}'),
  ('offerup', 100, 4000, '{"new":"New","like_new":"Like New","good":"Good","fair":"Fair","poor":"Poor"}')
ON CONFLICT (platform) DO NOTHING;
