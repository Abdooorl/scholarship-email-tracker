// Validate a Gmail refresh token locally before putting it in GitHub secrets.
//   node scripts/test-refresh.mjs

import readline from 'node:readline/promises';
import process from 'node:process';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const clientId = (await rl.question('GMAIL_CLIENT_ID: ')).trim();
  const clientSecret = (await rl.question('GMAIL_CLIENT_SECRET: ')).trim();
  const refreshToken = (await rl.question('GMAIL_REFRESH_TOKEN: ')).trim();
  rl.close();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    console.error(`\nINVALID (${res.status}): ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();
  console.log('\nVALID — access token obtained.');
  console.log(`Scope granted: ${json.scope}`);
  console.log('This exact string works — make sure the same one is in GITHUB secret GMAIL_REFRESH_TOKEN (no quotes, no "GMAIL_REFRESH_TOKEN=" prefix).');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
