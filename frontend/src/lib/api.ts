import type { EmailDetail, EmailSummary, Stats, Status, Topic } from '../types';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface ListParams {
  status?: Status | 'all';
  topic?: Topic | 'all';
  q?: string;
  limit?: number;
  offset?: number;
}

function listQuery(params: ListParams): string {
  const sp = new URLSearchParams();
  if (params.status && params.status !== 'all') sp.set('status', params.status);
  if (params.topic && params.topic !== 'all') sp.set('topic', params.topic);
  if (params.q) sp.set('q', params.q);
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  stats: () => getJson<Stats>('/api/stats'),
  emails: (params: ListParams = {}) =>
    getJson<{ emails: EmailSummary[] }>(`/api/emails${listQuery(params)}`),
  email: (id: string) => getJson<EmailDetail>(`/api/emails/${encodeURIComponent(id)}`),
};

export function gmailLink(email: Pick<EmailDetail, 'rfc822_message_id' | 'thread_id'>): string {
  if (email.rfc822_message_id) {
    return `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(
      email.rfc822_message_id
    )}`;
  }
  if (email.thread_id) {
    return `https://mail.google.com/mail/u/0/#inbox/${email.thread_id}`;
  }
  return 'https://mail.google.com/mail/u/0/';
}
