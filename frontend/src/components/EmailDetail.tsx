import { useEffect, useState } from 'react';
import { api, gmailLink } from '../lib/api';
import type { EmailDetail } from '../types';

interface Props {
  id: string;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  other: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
};

export default function EmailDetailModal({ id, onClose }: Props) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEmail(null);
    setError(null);
    api
      .email(id)
      .then((data) => {
        if (!cancelled) setEmail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white">
                {email?.subject ?? (error ? 'Error' : 'Loading…')}
              </h2>
              <p className="mt-0.5 truncate text-sm text-slate-400">
                {email ? `${email.sender || email.sender_email || 'Unknown'} — ` : ''}
                {email?.received_at &&
                  new Date(email.received_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          {(email || error) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {email && (
                <>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                      STATUS_BADGE[email.status] ?? STATUS_BADGE.other
                    }`}
                  >
                    {email.status}
                  </span>
                  {email.topic !== 'other' && (
                    <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] capitalize text-slate-300">
                      {email.topic}
                    </span>
                  )}
                  {email.matched_keywords?.map((kw) => (
                    <span
                      key={kw}
                      title="Classifier keyword match"
                      className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300"
                    >
                      {kw}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-rose-500/10 p-2 text-sm text-rose-300">{error}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {email ? (
            email.body ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-300">
                {email.body}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">No readable body stored for this email.</p>
            )
          ) : (
            !error && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-slate-800" />
                ))}
              </div>
            )
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 p-4">
          {email && (
            <a
              href={gmailLink(email)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-red-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            >
              Open in Gmail ↗
            </a>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
