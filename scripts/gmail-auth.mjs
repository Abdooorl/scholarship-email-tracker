// ONE-TIME setup: run this locally to obtain a Gmail OAuth2 refresh token.
//
//   node scripts/gmail-auth.mjs
//
// Before running:
//   1. Google Cloud Console -> create/select a project
//   2. Enable the "Gmail API" (APIs & Services -> Library)
//   3. APIs & Services -> OAuth consent screen -> External -> add yourself as test user
//   4. APIs & Services -> Credentials -> Create credentials -> OAuth client ID
//      - Application type: Web application
//      - Authorized redirect URI: http://localhost:53682
//
// The script opens your browser, you consent as badamosiabdullahi@gmail.com,
// and it prints ready-to-paste values for your GitHub repo secrets.

import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline/promises';

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question).then((a) => {
    rl.close();
    return a.trim();
  });
}

async function exchange(code, clientId, clientSecret, codeVerifier) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}\n${await res.text()}`);
  return res.json();
}

async function main() {
  const clientId = await ask('GMAIL_CLIENT_ID: ');
  const clientSecret = await ask('GMAIL_CLIENT_SECRET: ');
  if (!clientId || !clientSecret) throw new Error('Client id and secret are required.');

  // PKCE (S256)
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const state = crypto.randomBytes(16).toString('hex');

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', SCOPE);
  authorizeUrl.searchParams.set('access_type', 'offline');
  authorizeUrl.searchParams.set('prompt', 'consent');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const server = http.createServer((req, res) => {});
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`\nListening for OAuth callback on ${REDIRECT_URI}`);

  const urlPromise = new Promise((resolve, reject) => {
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><body style="font-family:sans-serif;text-align:center;padding-top:4rem;"><h2>Authorization received.</h2><p>You can close this tab and return to the terminal.</p></body></html>'
      );
      resolve(url);
    });
    server.on('error', reject);
  });

  console.log('\nOpening browser for consent (sign in as badamosiabdullahi@gmail.com)...');
  const openCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${openCmd} "${authorizeUrl.toString()}"`, (err) => {
    if (err) console.log(`Open this URL manually:\n\n${authorizeUrl.toString()}\n`);
  });

  const callbackUrl = await urlPromise;
  server.close();

  if (callbackUrl.searchParams.get('state') !== state) throw new Error('OAuth state mismatch.');
  const error = callbackUrl.searchParams.get('error');
  if (error) throw new Error(`Authorization failed: ${error}`);
  const code = callbackUrl.searchParams.get('code');
  if (!code) throw new Error('No authorization code in callback.');

  console.log('Exchanging authorization code...');
  const tokens = await exchange(code, clientId, clientSecret, codeVerifier);
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. Re-run the script — make sure prompt=consent is used and the app is removed from https://myaccount.google.com/permissions first.'
    );
  }

  const ingestSecret = crypto.randomBytes(32).toString('hex');

  console.log('\n================ SUCCESS — add these to GitHub repo secrets ================\n');
  console.log(`GMAIL_CLIENT_ID=${clientId}`);
  console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('');
  console.log('# Suggested value for the ingest shared secret (set on BOTH GitHub and the Worker):');
  console.log(`INGEST_SECRET=${ingestSecret}`);
  console.log('');
  console.log('# After deploying the Worker, set:');
  console.log('# WORKER_URL=https://<your-worker-subdomain>.workers.dev');
  console.log('\n============================================================================');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
