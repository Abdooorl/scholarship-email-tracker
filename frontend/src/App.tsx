import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import type { EmailSummary, Stats } from './types';
import type { Filters as FilterState } from './components/FilterBar';
import FilterBar from './components/FilterBar';
import EmailList from './components/EmailList';
import EmailDetailModal from './components/EmailDetail';

const ACCOUNT = 'badamosiabdullahi@gmail.com';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    scholarshipsOnly: true,
    q: '',
  });
  const debouncedQ = useDebounced(filters.q, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, listData] = await Promise.all([
        api.stats(),
        api.emails({
          status: filters.status,
          topic: filters.scholarshipsOnly ? 'scholarship' : 'all',
          q: debouncedQ || undefined,
          limit: 100,
        }),
      ]);
      setStats(statsData);
      setEmails(listData.emails ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.scholarshipsOnly, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const scholarshipNote = useMemo(() => {
    if (!stats) return '';
    return `${stats.scholarship_accepted} accepted / ${stats.scholarship_rejected} rejected of ${stats.scholarship_total} scholarship-related`;
  }, [stats]);

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Scholarship Email Tracker
          </h1>
          <p className="text-sm text-slate-500">{ACCOUNT}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Tracked" value={stats.total} accent="text-white" />
            <StatCard label="Accepted" value={stats.accepted} accent="text-emerald-400" />
            <StatCard label="Rejected" value={stats.rejected} accent="text-rose-400" />
            <StatCard
              label="Scholarships"
              value={stats.scholarship_total}
              accent="text-sky-400"
            />
          </section>
          <p className="-mt-3 text-xs text-slate-600">{scholarshipNote}</p>
        </>
      )}

      <FilterBar filters={filters} onChange={setFilters} />

      <main className="flex-1">
        <EmailList
          emails={emails}
          loading={loading}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>

      <footer className="pb-2 text-center text-xs text-slate-700">
        Synced every 15 minutes by GitHub Actions · classification is scholarship-gated
      </footer>

      {selectedId && <EmailDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
