'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import RunHistoryTable from '../implement-run-history-table-component';
import RunHistoryTableSkeleton from '../RunHistoryTableSkeleton';
import Pagination from '../Pagination';
import BulkActionsForRuns, { BulkAction } from '../add-bulk-actions-for-runs';
import { FuzzingRun } from '../types';

const ITEMS_PER_PAGE = 10;

type PageDataState = 'loading' | 'success' | 'error';

export default function RunsPage() {
  const [dataState, setDataState] = useState<PageDataState>('loading');
  const [runs, setRuns] = useState<FuzzingRun[]>([]);
  const [fetchAttempt, setFetchAttempt] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    const loadRuns = async () => {
      setDataState('loading');
      try {
        const res = await fetch('/api/runs', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setRuns(data.runs ?? []);
          setDataState('success');
        }
      } catch {
        if (!cancelled) setDataState('error');
      }
    };

    void loadRuns();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [fetchAttempt]);

  const totalPages = Math.max(1, Math.ceil(runs.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRuns = runs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const selectedRuns = useMemo(
    () => runs.filter((run) => selectedRunIds.has(run.id)),
    [runs, selectedRunIds],
  );

  const handleToggleRunSelection = useCallback((runId: string) => {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  }, []);

  const handleToggleAllRunsSelection = useCallback((runIds: string[]) => {
    setSelectedRunIds((prev) => {
      if (prev.size === runIds.length && runIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(runIds);
    });
  }, []);

  const handleBulkAction = useCallback(
    (action: BulkAction, runIds: string[], data?: Record<string, unknown>) => {
      if (action === 'delete') {
        setRuns((prev) => prev.filter((r) => !runIds.includes(r.id)));
        setSelectedRunIds(new Set());
      } else if (action === 'cancel') {
        setRuns((prev) =>
          prev.map((r) =>
            runIds.includes(r.id) ? { ...r, status: 'cancelled' } : r,
          ),
        );
      } else if (action === 'retry') {
        setRuns((prev) =>
          prev.map((r) =>
            runIds.includes(r.id) ? { ...r, status: 'running' } : r,
          ),
        );
      } else {
        console.log('Bulk action:', action, runIds, data);
      }

      if (action !== 'export') {
        setSelectedRunIds(new Set());
      }
    },
    [],
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedRunIds(new Set());
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Fuzzing Runs
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Select runs to cancel, retry, delete, export, tag, or assign in
            bulk.
          </p>
        </div>
        {dataState === 'success' && (
          <div className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-medium text-zinc-500">
            {runs.length} Total Runs
          </div>
        )}
      </div>

      {dataState === 'loading' && (
        <RunHistoryTableSkeleton rows={ITEMS_PER_PAGE} />
      )}

      {dataState === 'error' && (
        <div className="flex flex-col items-center gap-4 border border-red-200 dark:border-red-900/50 rounded-xl p-8 bg-red-50/60 dark:bg-red-950/20 text-center">
          <p className="font-semibold text-red-900 dark:text-red-100">
            Failed to load fuzzing runs
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => setFetchAttempt((n) => n + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {dataState === 'success' && (
        <>
          <div className="mb-4">
            <BulkActionsForRuns
              selectedRuns={selectedRuns}
              onAction={handleBulkAction}
              onClearSelection={() => setSelectedRunIds(new Set())}
            />
          </div>
          <RunHistoryTable
            runs={paginatedRuns}
            onSelectRun={() => {}}
            onViewReport={() => {}}
            selectedRunIds={selectedRunIds}
            onToggleRunSelection={handleToggleRunSelection}
            onToggleAllRunsSelection={handleToggleAllRunsSelection}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
