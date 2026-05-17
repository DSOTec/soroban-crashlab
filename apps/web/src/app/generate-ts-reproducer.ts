// TypeScript Reproducer Snippet Generator
// Exports failing case as a TypeScript reproducer helper for web tests.
// Outputs are stable and deterministic given the same input.

export interface ReproducerInput<TInput = unknown, TExpected = unknown, TActual = unknown> {
  testName: string;
  input: TInput;
  expected: TExpected;
  actual: TActual;
  dependencies?: string[];
}

export interface ReproducerOptions {
  /** Framework-level import to prepend, e.g. "@jest/globals". Defaults to none. */
  frameworkImport?: string;
  /** Milliseconds before the test times out. Omit to use framework default. */
  timeoutMs?: number;
  /** Emit a `test.skip` wrapper instead of a normal test. */
  skipIf?: boolean;
}

export interface CaseBundleExport {
  seedId: number;
  inputPayloadHex: string;
  failureClass: string;
  signatureHash: string;
  mode: string;
}

/** Escapes a string for safe embedding inside a template literal or single-quoted string. */
function escapeTestName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Generates a self-contained TypeScript test snippet that reproduces a failing case.
 *
 * The output is deterministic: identical inputs always produce identical snippets.
 * Generated snippets are compatible with Jest, Vitest, and any framework that
 * implements the `describe` / `it` / `expect` globals.
 */
export function generateTSReproducer<TInput = unknown, TExpected = unknown, TActual = unknown>(
  { testName, input, expected, actual, dependencies = [] }: ReproducerInput<TInput, TExpected, TActual>,
  options: ReproducerOptions = {},
): string {
  const { frameworkImport, timeoutMs, skipIf = false } = options;

  const lines: string[] = [];

  if (frameworkImport) {
    lines.push(`import { describe, it, expect } from '${frameworkImport}';`);
    lines.push('');
  }

  const sortedDeps = [...dependencies].sort();
  for (const dep of sortedDeps) {
    lines.push(`import ${dep} from '${dep}';`);
  }
  if (sortedDeps.length > 0) {
    lines.push('');
  }

  const safeName = escapeTestName(testName);
  const itKeyword = skipIf ? 'it.skip' : 'it';
  const timeoutArg = timeoutMs !== undefined ? `, ${timeoutMs}` : '';

  lines.push(`// Reproducer for: ${testName}`);
  lines.push(`// Dependencies: ${sortedDeps.join(', ') || 'none'}`);
  lines.push(`describe('${safeName}', () => {`);
  lines.push(
    `  ${itKeyword}('should reproduce the failure', () => {`,
  );
  if (timeoutMs !== undefined) {
    // Jest/Vitest accept timeout as a third arg to it(); rewrite the opening line.
    lines[lines.length - 1] = `  ${itKeyword}('should reproduce the failure'${timeoutArg}, () => {`;
  }
  lines.push(`    const input = ${JSON.stringify(input, null, 2).replace(/\n/g, '\n    ')};`);
  lines.push(`    // Replace with actual function call`);
  lines.push(`    const result = /* call function with input */ undefined;`);
  lines.push(`    // Expected: ${JSON.stringify(expected)}`);
  lines.push(`    // Actual:   ${JSON.stringify(actual)}`);
  lines.push(`    expect(result).toEqual(${JSON.stringify(expected, null, 2).replace(/\n/g, '\n    ')});`);
  lines.push(`  });`);
  lines.push(`});`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generates a TypeScript reproducer snippet from a `CaseBundleExport` — the
 * JSON-serializable form produced by the Rust generator.
 *
 * The snippet documents the hex payload, failure class, and signature hash so a
 * maintainer can locate the bundle without manual guesswork.
 */
export function generateTSReproducerFromBundle(
  bundle: CaseBundleExport,
  options: ReproducerOptions = {},
): string {
  const testName = `seed-${bundle.seedId}-${bundle.failureClass}`;

  const input = {
    seedId: bundle.seedId,
    payloadHex: bundle.inputPayloadHex,
    mode: bundle.mode,
  };

  const expected = {
    failureClass: bundle.failureClass,
    signatureHash: bundle.signatureHash,
  };

  const actual = {
    failureClass: 'unknown',
    signatureHash: '0x0000000000000000',
  };

  return generateTSReproducer({ testName, input, expected, actual }, options);
}

/**
 * Returns the sorted, deduplicated list of import lines for the given dependency names.
 * Useful when assembling a snippet header separately from the test body.
 */
export function formatReproducerDependencies(dependencies: string[]): string {
  return [...new Set(dependencies)]
    .sort()
    .map(dep => `import ${dep} from '${dep}';`)
    .join('\n');
}
