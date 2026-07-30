const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5500',
  sessionExpiry: process.env.SESSION_EXPIRY || '7d',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    attachmentsBucket: process.env.ATTACHMENTS_BUCKET || 'entry-attachments',
  },
};

const required = ['supabase.url', 'supabase.anonKey'];
const missing = required.filter((k) => {
  const parts = k.split('.');
  let val = config;
  for (const p of parts) val = val[p];
  return !val;
});

if (missing.length) {
  console.error('Missing required environment variables:', missing.join(', '));
  console.error('Copy .env.example to .env and fill in your values.');
  process.exit(1);
}

module.exports = config;
