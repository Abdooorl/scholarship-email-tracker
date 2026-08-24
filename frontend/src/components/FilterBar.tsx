import type { Status } from '../types';

export interface Filters {
  status: Status | 'all';
  scholarshipsOnly: boolean;
  q: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const STATUS_TABS: { value: Status | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'other', label: 'Other' },
];

export default function FilterBar({ filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="flex overflow-hidden rounded-lg border border-slate-800"
        role="tablist"
        aria-label="Filter by status"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={filters.status === tab.value}
            onClick={() => set({ status: tab.value })}
            className={`px-3 py-1.5 text-sm transition-colors ${
              filters.status === tab.value
                ? 'bg-slate-700/80 font-medium text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => set({ scholarshipsOnly: !filters.scholarshipsOnly })}
        aria-pressed={filters.scholarshipsOnly}
        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
          filters.scholarshipsOnly
            ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
            : 'border-slate-800 text-slate-400 hover:bg-slate-800/50'
        }`}
      >
        Scholarships only
      </button>

      <input
        type="search"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Search sender, subject…"
        className="ml-auto w-full max-w-xs rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none"
      />
    </div>
  );
}
