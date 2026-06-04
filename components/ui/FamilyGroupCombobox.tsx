'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchFamilyGroups, createFamilyGroup } from '@/lib/queries/familyGroups';
import type { FamilyGroup } from '@/lib/queries/familyGroups';

interface Props {
  value: string;
  familyGroupId: string;
  onChange: (name: string, id: string) => void;
}

export default function FamilyGroupCombobox({ value, familyGroupId, onChange }: Props) {
  const [groups,   setGroups]   = useState<FamilyGroup[]>([]);
  const [query,    setQuery]    = useState(value);
  const [open,     setOpen]     = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFamilyGroups().then(setGroups).catch(console.error);
  }, []);

  // Keep query in sync when value changes from outside (e.g. form reset)
  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = query.trim()
    ? groups.filter(g => g.family_name.toLowerCase().includes(query.toLowerCase()))
    : groups;

  const normalised = (s: string) => s.toLowerCase().replace(/^obitelj\s+/i, '').trim();
  const showCreate =
    query.trim().length > 1 &&
    !groups.some(g => normalised(g.family_name) === normalised(query));

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createFamilyGroup(name);
      setGroups(prev =>
        [...prev, created].sort((a, b) => a.family_name.localeCompare(b.family_name, 'hr')),
      );
      onChange(created.family_name, created.id);
      setQuery(created.family_name);
      setOpen(false);
    } catch (e) {
      console.error('[FamilyGroupCombobox] create failed:', e);
    } finally {
      setCreating(false);
    }
  }

  function handleSelect(g: FamilyGroup) {
    onChange(g.family_name, g.id);
    setQuery(g.family_name);
    setOpen(false);
  }

  function handleClear() {
    onChange('', '');
    setQuery('');
  }

  const displayLabel = query.trim()
    ? `Stvori "${query.startsWith('Obitelj ') ? query : `Obitelj ${query}`}"`
    : 'Nova obitelj...';

  return (
    <div ref={ref} className="relative">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        Obitelj / Skrbnik
      </label>
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Pretraži ili stvori obitelj..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-16 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {(value || query) && (
            <button type="button" onClick={handleClear}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setOpen(o => !o)}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-150', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {familyGroupId && (
        <p className="text-xs text-green-400 mt-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Vezano uz obiteljsku grupu
        </p>
      )}

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && !showCreate && (
              <p className="text-xs text-slate-500 px-3.5 py-3">Nema pronađenih obitelji</p>
            )}
            {filtered.map(g => (
              <button key={g.id} type="button" onClick={() => handleSelect(g)}
                className={cn(
                  'w-full text-left px-3.5 py-2.5 text-sm hover:bg-slate-700 transition-colors',
                  g.id === familyGroupId ? 'text-red-300 font-semibold' : 'text-slate-200',
                )}>
                {g.family_name}
              </button>
            ))}
          </div>
          {showCreate && (
            <div className="border-t border-slate-700">
              <button type="button" onClick={handleCreate} disabled={creating}
                className="w-full text-left px-3.5 py-2.5 text-sm text-green-400 hover:bg-slate-700 flex items-center gap-2 transition-colors disabled:opacity-60">
                {creating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  : <Plus className="w-3.5 h-3.5 flex-shrink-0" />}
                {displayLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
