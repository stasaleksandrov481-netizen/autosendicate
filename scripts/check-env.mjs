const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'SESSION_SECRET'
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error('Missing required environment variables:\n' + missing.map((x) => ` - ${x}`).join('\n'));
  process.exit(1);
}
if ((process.env.SESSION_SECRET ?? '').length < 32) {
  console.error('SESSION_SECRET must be at least 32 characters.');
  process.exit(1);
}
console.log('Environment looks valid.');
