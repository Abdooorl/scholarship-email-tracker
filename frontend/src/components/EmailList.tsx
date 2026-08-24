import type { EmailSummary, Status } from '../types';

const STATUS_STYLES: Record<Status, string> = {
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  other: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
};

const BORDER_STYLES: Record<Status, string> = {
  accepted: 'border-l-emerald-500',
  rejected: 'border-l-rose-500',
  other: 'border-l-slate-600',
};

function formatDate(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isNew(ts: number | null): boolean {
  return ts != null && Date.now() - ts < 24 * 60 * 60 * 1000;
}

interface Props {
  emails: EmailSummary[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function EmailList({ emails, loading, error, selectedId, onSelect }: Props) {
  if (loading && emails.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-900/80" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        Failed to load emails: {error}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
        No tracked emails yet. Once the GitHub Action runs and finds scholarship
        decisions in your inbox, they will appear here.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-800/70 overflow-hidden rounded-xl border border-slate-800">
      {emails.map((email) => (
        <li key={email.id}>
          <button
            onClick={() => onSelect(email.id)}
            className={`w-full border-l-4 bg-slate-900/40 px-4 py-3 text-left transition-colors hover:bg-slate-800/60 ${
              BORDER_STYLES[email.status]
            } ${selectedId === email.id ? 'bg-slate-800/80' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-300">
                {(email.sender?.[0] ?? '?').toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-200">
                    {email.sender || email.sender_email || 'Unknown sender'}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">
                    {formatDate(email.received_at)}
                    {isNew(email.received_at) && (
                      <span className="ml-2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                        new
                      </span>
                    )}
                  </span>
                </div>

                <div className="truncate text-sm font-medium text-white">{email.subject}</div>

                <div className="truncate text-xs text-slate-500">{email.snippet}</div>

                <div className="mt-1.5 flex gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[email.status]}`}
                  >
                    {email.status}
                  </span>
                  {email.topic !== 'other' && (
                    <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] capitalize text-slate-300">
                      {email.topic}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
