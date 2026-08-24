import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  INGEST_SECRET?: string;
};

type EmailInput = {
  id?: unknown;
  threadId?: unknown;
  rfc822MessageId?: unknown;
  sender?: unknown;
  senderEmail?: unknown;
  subject?: unknown;
  snippet?: unknown;
  body?: unknown;
  status?: unknown;
  topic?: unknown;
  matched?: unknown;
  receivedAt?: unknown;
};

const STATUSES = new Set(['accepted', 'rejected', 'other']);
const TOPICS = new Set(['scholarship', 'job', 'other']);

const LIST_COLUMNS =
  'id, thread_id, sender, sender_email, subject, snippet, status, topic, received_at';

const UPSERT_SQL = `
  INSERT INTO emails (
    id, thread_id, rfc822_message_id, sender, sender_email,
    subject, snippet, body, status, topic, matched_keywords,
    received_at, updated_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
  ON CONFLICT(id) DO UPDATE SET
    thread_id = excluded.thread_id,
    rfc822_message_id = excluded.rfc822_message_id,
    subject = excluded.subject,
    snippet = excluded.snippet,
    body = excluded.body,
    status = excluded.status,
    topic = excluded.topic,
    matched_keywords = excluded.matched_keywords,
    updated_at = excluded.updated_at
`;

function str(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLen);
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : Date.now();
}

/** Length-independent string comparison via SHA-256 digests. */
async function secretsMatch(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all(
    [a, b].map((s) =>
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then((buf) =>
        Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      )
    )
  );
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da.charCodeAt(i) ^ db.charCodeAt(i);
  return diff === 0;
}

const app = new Hono<{ Bindings: Bindings }>();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted,
       COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected,
       COALESCE(SUM(CASE WHEN topic = 'scholarship' THEN 1 ELSE 0 END), 0) AS scholarship_total,
       COALESCE(SUM(CASE WHEN topic = 'scholarship' AND status = 'accepted' THEN 1 ELSE 0 END), 0) AS scholarship_accepted,
       COALESCE(SUM(CASE WHEN topic = 'scholarship' AND status = 'rejected' THEN 1 ELSE 0 END), 0) AS scholarship_rejected
     FROM emails`
  ).first<Record<string, number>>();

  return c.json(row ?? {});
});

app.get('/api/emails', async (c) => {
  const status = c.req.query('status') ?? '';
  const topic = c.req.query('topic') ?? '';
  const q = (c.req.query('q') ?? '').trim();
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (STATUSES.has(status)) {
    where.push('status = ?');
    binds.push(status);
  }
  if (TOPICS.has(topic)) {
    where.push('topic = ?');
    binds.push(topic);
  }
  if (q) {
    where.push('(subject LIKE ? OR sender LIKE ? OR snippet LIKE ?)');
    const like = `%${q}%`;
    binds.push(like, like, like);
  }

  const sql = `SELECT ${LIST_COLUMNS} FROM emails
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY received_at DESC LIMIT ? OFFSET ?`;

  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds, limit, offset)
    .all();

  return c.json({ emails: results });
});

app.get('/api/emails/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM emails WHERE id = ?1`)
    .bind(c.req.param('id'))
    .first();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(row);
});

app.post('/api/ingest', async (c) => {
  const provided = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const expected = c.env.INGEST_SECRET ?? '';
  if (!expected || !provided || !(await secretsMatch(provided, expected))) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const payload = await c.req.json<Record<string, unknown>>().catch(() => null);
  const items = payload?.emails;
  if (!Array.isArray(items) || items.length === 0) {
    return c.json({ error: 'emails[] required' }, 400);
  }

  const stmt = c.env.DB.prepare(UPSERT_SQL);
  const statements: D1PreparedStatement[] = [];
  for (const raw of items.slice(0, 500)) {
    const m = raw as EmailInput;
    if (typeof m.id !== 'string' || !m.id) continue;
    const status = typeof m.status === 'string' && STATUSES.has(m.status) ? m.status : 'other';
    const topic = typeof m.topic === 'string' && TOPICS.has(m.topic) ? m.topic : 'other';
    const matched = Array.isArray(m.matched) ? m.matched.filter((k) => typeof k === 'string').slice(0, 20) : [];

    statements.push(
      stmt.bind(
        m.id,
        str(m.threadId, 256),
        str(m.rfc822MessageId, 998),
        str(m.sender, 320),
        str(m.senderEmail, 320),
        str(m.subject, 1000),
        str(m.snippet, 500),
        str(m.body, 200000),
        status,
        topic,
        JSON.stringify(matched),
        num(m.receivedAt),
        Date.now()
      )
    );
  }

  if (statements.length === 0) {
    return c.json({ error: 'no valid emails in payload' }, 400);
  }

  await c.env.DB.batch(statements);
  return c.json({ ingested: statements.length });
});

// Everything that is not /api/* falls through to the static SPA assets.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
