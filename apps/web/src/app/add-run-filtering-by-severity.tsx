'use client';

import React from 'react';
import { FuzzingRun, RunSeverity } from './types';

export interface RunSeverityFilterProps {
  value: 'all' | RunSeverity;
  onChange: (value: 'all' | RunSeverity) => void;
  disabled?: boolean;
}

export const SEVERITY_OPTIONS: Array<'all' | RunSeverity> = ['all', 'low', 'medium', 'high', 'critical'];

/**
 * Returns true if the run matches the given severity filter.
 * 'all' always matches.
 */
export function matchesSeverityFilter(run: FuzzingRun, filter: 'all' | RunSeverity): boolean {
  if (filter === 'all') return true;
  return run.severity === filter;
}

/**
 * Filters a list of runs by severity.
 */
export function filterRunsBySeverity(runs: FuzzingRun[], filter: 'all' | RunSeverity): FuzzingRun[] {
  if (filter === 'all') return runs;
  return runs.filter((run) => run.severity === filter);
}

/**
 * Returns true if the given string is a valid severity filter value.
 */
export function isValidSeverityFilter(value: string): value is 'all' | RunSeverity {
  return (SEVERITY_OPTIONS as string[]).includes(value);
}

/**
 * Filter component for selecting run severity.
 */
export default function RunSeverityFilter({ value, onChange, disabled = false }: RunSeverityFilterProps) {
  return (
    <label className="flex items-center gap-3 group">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-hidden="true" />
        <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-widest group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          Severity
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'all' | RunSeverity)}
        disabled={disabled}
        aria-label="Filter runs by severity"
        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xl shadow-black/5 transition-all cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {SEVERITY_OPTIONS.map((opt) => (
          <option key={opt} value={opt} className="bg-white dark:bg-zinc-900 font-bold">
            {opt === 'all' ? 'All Levels' : opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
