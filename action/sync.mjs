// GitHub Action sync job: Gmail -> classify -> Cloudflare Worker /api/ingest.
//
// Required env:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//   WORKER_URL (e.g. https://scholarship-email-tracker.you.workers.dev)
//   INGEST_SECRET
// Optional env:
//   SYNC_LOOKBACK_DAYS (default 2), SYNC_MAX_MESSAGES (default 200)

import { classifyEmail } from './classify.mjs';

const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function getAccessToken() {
  const res = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GMAIL_CLIENT_ID'),
      client_secret: requireEnv('GMAIL_CLIENT_SECRET'),
      refresh_token: requireEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

async function api(token, path) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function listMessageIds(token, query, maxTotal) {
  const ids = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ q: query, maxResults: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await api(token, `/messages?${params}`);
    for (const m of page.messages ?? []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < maxTotal);
  return ids.slice(0, maxTotal);
}

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function decodeMimeWords(value) {
  // RFC 2047 encoded words, e.g. =?UTF-8?B?...?= or =?UTF-8?Q?...?=
  return String(value).replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (_, charset, enc, text) => {
      try {
        const buf =
          enc.toLowerCase() === 'b'
            ? Buffer.from(text, 'base64')
            : Buffer.from(text.replace(/_=([0-9A-Fa-f]{2})/g, '=$1'), 'quoted-printable');
        return buf.toString('utf8');
      } catch {
        return _;
      }
    }
  );
}

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function extractBody(payload) {
  if (!payload) return '';
  const mime = payload.mimeType ?? '';
  if ((mime === 'text/plain' || mime === 'text/html') && payload.body?.data) {
    const text = decodeBase64Url(payload.body.data);
    return mime === 'text/html' ? htmlToText(text) : text.trim();
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        const t = extractBody(part);
        if (t) return t;
      }
    }
    for (const part of payload.parts) {
      const t = extractBody(part);
      if (t) return t;
    }
  }
  return '';
}

function header(msg, name) {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function parseSender(raw) {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { sender: m[1].trim() || m[2], senderEmail: m[2].trim() };
  return { sender: raw.trim(), senderEmail: raw.trim() };
}

function parseMessage(msg) {
  const { sender, senderEmail } = parseSender(decodeMimeWords(header(msg, 'From')));
  const subject = decodeMimeWords(header(msg, 'Subject')) || '(no subject)';
  const bodyText = extractBody(msg.payload);
  const dateHeader = header(msg, 'Date');
  const internalDate = Number(msg.internalDate ?? 0);
  const receivedAt = dateHeader ? new Date(dateHeader).getTime() || internalDate : internalDate;

  return {
    id: msg.id,
    threadId: msg.threadId,
    rfc822MessageId: header(msg, 'Message-ID'),
    sender,
    senderEmail,
    subject,
    snippet: bodyText.slice(0, 280),
    body: bodyText.slice(0, 200000),
    receivedAt,
  };
}

async function ingest(workerUrl, secret, emails) {
  const res = await fetch(`${workerUrl.replace(/\/$/, '')}/api/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emails }),
  });
  if (!res.ok) throw new Error(`Ingest failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const lookbackDays = parseInt(process.env.SYNC_LOOKBACK_DAYS ?? '2', 10);
  const maxMessages = parseInt(process.env.SYNC_MAX_MESSAGES ?? '200', 10);
  const workerUrl = requireEnv('WORKER_URL');
  const secret = requireEnv('INGEST_SECRET');

  console.log('Refreshing access token...');
  const token = await getAccessToken();

  const query = `in:inbox newer_than:${lookbackDays}d`;
  console.log(`Listing messages: "${query}"`);
  const ids = await listMessageIds(token, query, maxMessages);
  console.log(`Found ${ids.length} message(s)`);

  const batch = [];
  let accepted = 0;
  let rejected = 0;
  let skippedJobs = 0;

  for (const id of ids) {
    const msg = await api(token, `/messages/${id}?format=full`);
    const parsed = parseMessage(msg);
    const { status, topic, matched } = classifyEmail(parsed);

    // Scholarship-gated tracking: job applications are never stored.
    if (topic === 'job') {
      skippedJobs++;
      continue;
    }

    if (status === 'accepted') accepted++;
    if (status === 'rejected') rejected++;

    batch.push({ ...parsed, status, topic, matched });
  }

  if (batch.length === 0) {
    console.log(`Nothing scholarship-related to push (skipped ${skippedJobs} job email(s)).`);
    return;
  }

  const CHUNK = 25;
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const out = await ingest(workerUrl, secret, chunk);
    console.log(`Pushed ${chunk.length} email(s): ${JSON.stringify(out)}`);
  }

  console.log(
    `Done. tracked=${batch.length}, accepted=${accepted}, rejected=${rejected}, other=${batch.length - accepted - rejected}, jobsSkipped=${skippedJobs}`
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
