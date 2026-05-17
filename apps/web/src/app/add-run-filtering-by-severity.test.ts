import {
  filterRunsBySeverity,
  isValidSeverityFilter,
  matchesSeverityFilter,
  SEVERITY_OPTIONS,
} from './add-run-filtering-by-severity';
import { FuzzingRun, RunSeverity } from './types';

function makeRun(overrides: Partial<FuzzingRun> = {}): FuzzingRun {
  return {
    id: 'run-001',
    status: 'completed',
    area: 'auth',
    severity: 'low',
    duration: 1000,
    seedCount: 10,
    crashDetail: null,
    cpuInstructions: 100,
    memoryBytes: 1024,
    minResourceFee: 0,
    ...overrides,
  };
}

describe('SEVERITY_OPTIONS', () => {
  it('contains all four severity levels plus "all"', () => {
    expect(SEVERITY_OPTIONS).toEqual(['all', 'low', 'medium', 'high', 'critical']);
  });
});

describe('isValidSeverityFilter', () => {
  it('returns true for "all"', () => {
    expect(isValidSeverityFilter('all')).toBe(true);
  });

  it.each(['low', 'medium', 'high', 'critical'] as RunSeverity[])(
    'returns true for valid severity "%s"',
    (sev) => {
      expect(isValidSeverityFilter(sev)).toBe(true);
    },
  );

  it('returns false for an unknown string', () => {
    expect(isValidSeverityFilter('extreme')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidSeverityFilter('')).toBe(false);
  });
});

describe('matchesSeverityFilter', () => {
  it('always returns true when filter is "all"', () => {
    const severities: RunSeverity[] = ['low', 'medium', 'high', 'critical'];
    severities.forEach((sev) => {
      expect(matchesSeverityFilter(makeRun({ severity: sev }), 'all')).toBe(true);
    });
  });

  it('returns true when run severity matches the filter', () => {
    expect(matchesSeverityFilter(makeRun({ severity: 'high' }), 'high')).toBe(true);
  });

  it('returns false when run severity does not match the filter', () => {
    expect(matchesSeverityFilter(makeRun({ severity: 'low' }), 'critical')).toBe(false);
  });

  it('returns false for a critical run when filter is "medium"', () => {
    expect(matchesSeverityFilter(makeRun({ severity: 'critical' }), 'medium')).toBe(false);
  });
});

describe('filterRunsBySeverity', () => {
  const runs: FuzzingRun[] = [
    makeRun({ id: 'r1', severity: 'low' }),
    makeRun({ id: 'r2', severity: 'medium' }),
    makeRun({ id: 'r3', severity: 'high' }),
    makeRun({ id: 'r4', severity: 'critical' }),
    makeRun({ id: 'r5', severity: 'critical' }),
  ];

  it('returns all runs when filter is "all"', () => {
    expect(filterRunsBySeverity(runs, 'all')).toHaveLength(5);
  });

  it('returns only runs matching the given severity', () => {
    const result = filterRunsBySeverity(runs, 'critical');
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.severity === 'critical')).toBe(true);
  });

  it('returns an empty array when no runs match the filter', () => {
    const result = filterRunsBySeverity(runs, 'low');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('returns an empty array when input is empty', () => {
    expect(filterRunsBySeverity([], 'high')).toEqual([]);
  });

  // Edge case: all runs share the same severity
  it('returns all runs when every run matches the filter', () => {
    const allHigh = [
      makeRun({ id: 'a', severity: 'high' }),
      makeRun({ id: 'b', severity: 'high' }),
    ];
    expect(filterRunsBySeverity(allHigh, 'high')).toHaveLength(2);
  });

  it('does not mutate the original array', () => {
    const original = [makeRun({ severity: 'low' }), makeRun({ severity: 'high' })];
    const copy = [...original];
    filterRunsBySeverity(original, 'low');
    expect(original).toEqual(copy);
  });
});
