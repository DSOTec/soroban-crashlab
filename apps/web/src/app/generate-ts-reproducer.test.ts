/**
 * Tests for Issue #397 – Generate TypeScript reproducer snippets
 *
 * Validates the pure generator functions in generate-ts-reproducer.ts.
 * Compiled and executed via `npm run test` using tsc + node.
 */

import * as assert from 'node:assert/strict';
import {
  generateTSReproducer,
  generateTSReproducerFromBundle,
  formatReproducerDependencies,
  type CaseBundleExport,
} from './generate-ts-reproducer';

// ── generateTSReproducer – primary flow ───────────────────────────────────────

function testSnippetContainsTestName(): void {
  const snippet = generateTSReproducer({
    testName: 'adds numbers',
    input: { a: 1, b: 2 },
    expected: 3,
    actual: 4,
  });
  assert.ok(snippet.includes("describe('adds numbers'"), 'snippet should contain describe block with test name');
  console.log('✓ testSnippetContainsTestName');
}

function testSnippetContainsShouldReproduceLabel(): void {
  const snippet = generateTSReproducer({
    testName: 'overflow check',
    input: { n: 2147483647 },
    expected: 'overflow',
    actual: 'ok',
  });
  assert.ok(snippet.includes('should reproduce the failure'), 'snippet should contain failure label');
  console.log('✓ testSnippetContainsShouldReproduceLabel');
}

function testSnippetIncludesExpectAssertion(): void {
  const snippet = generateTSReproducer({
    testName: 'token transfer',
    input: { from: 'A', to: 'B', amount: 100 },
    expected: { ok: true },
    actual: { ok: false },
  });
  assert.ok(snippet.includes('expect(result).toEqual('), 'snippet should include expect assertion');
  console.log('✓ testSnippetIncludesExpectAssertion');
}

function testDependenciesAreSortedAndImported(): void {
  const snippet = generateTSReproducer({
    testName: 'dep test',
    input: 'x',
    expected: 'y',
    actual: 'z',
    dependencies: ['zebra', 'alpha', 'myAddFunction'],
  });
  const importLines = snippet.split('\n').filter(l => l.startsWith('import '));
  assert.deepEqual(
    importLines,
    [
      "import alpha from 'alpha';",
      "import myAddFunction from 'myAddFunction';",
      "import zebra from 'zebra';",
    ],
    'imports should be alphabetically sorted',
  );
  console.log('✓ testDependenciesAreSortedAndImported');
}

function testNoDependenciesProducesNoneComment(): void {
  const snippet = generateTSReproducer({
    testName: 'no deps',
    input: null,
    expected: null,
    actual: null,
  });
  assert.ok(snippet.includes('Dependencies: none'), 'snippet should note no dependencies');
  console.log('✓ testNoDependenciesProducesNoneComment');
}

// ── generateTSReproducer – options ────────────────────────────────────────────

function testFrameworkImportPrepended(): void {
  const snippet = generateTSReproducer(
    { testName: 't', input: 0, expected: 1, actual: 2 },
    { frameworkImport: '@jest/globals' },
  );
  assert.ok(
    snippet.startsWith("import { describe, it, expect } from '@jest/globals';"),
    'framework import should be the first line',
  );
  console.log('✓ testFrameworkImportPrepended');
}

function testSkipIfEmitsItSkip(): void {
  const snippet = generateTSReproducer(
    { testName: 'flaky', input: 0, expected: 1, actual: 2 },
    { skipIf: true },
  );
  assert.ok(snippet.includes('it.skip('), 'skipIf should emit it.skip');
  console.log('✓ testSkipIfEmitsItSkip');
}

function testTimeoutArgAppended(): void {
  const snippet = generateTSReproducer(
    { testName: 'slow', input: 0, expected: 1, actual: 2 },
    { timeoutMs: 5000 },
  );
  assert.ok(snippet.includes(', 5000,'), 'timeout should appear as third arg');
  console.log('✓ testTimeoutArgAppended');
}

// ── generateTSReproducer – edge cases ─────────────────────────────────────────

function testOutputIsDeterministic(): void {
  const params = {
    testName: 'determinism check',
    input: { key: 'val' },
    expected: true,
    actual: false,
    dependencies: ['beta', 'alpha'],
  };
  const a = generateTSReproducer(params);
  const b = generateTSReproducer(params);
  assert.equal(a, b, 'identical inputs must produce identical output');
  console.log('✓ testOutputIsDeterministic');
}

function testTestNameWithSingleQuoteIsEscaped(): void {
  const snippet = generateTSReproducer({
    testName: "it's broken",
    input: 0,
    expected: 1,
    actual: 2,
  });
  assert.ok(!snippet.includes("describe('it's"), "unescaped single quote must not appear in output");
  assert.ok(snippet.includes("it\\'s"), 'single quote in test name should be escaped');
  console.log('✓ testTestNameWithSingleQuoteIsEscaped');
}

function testNullInputSerialises(): void {
  const snippet = generateTSReproducer({
    testName: 'null input',
    input: null,
    expected: null,
    actual: null,
  });
  assert.ok(snippet.includes('const input = null'), 'null input should serialise to null literal');
  console.log('✓ testNullInputSerialises');
}

// ── generateTSReproducerFromBundle ────────────────────────────────────────────

function testFromBundleProducesRunnableSnippet(): void {
  const bundle: CaseBundleExport = {
    seedId: 42,
    inputPayloadHex: 'deadbeef',
    failureClass: 'runtime-failure',
    signatureHash: '0xabcd1234',
    mode: 'invoker',
  };
  const snippet = generateTSReproducerFromBundle(bundle);
  assert.ok(snippet.includes('seed-42-runtime-failure'), 'snippet should embed seed ID and failure class');
  assert.ok(snippet.includes('deadbeef'), 'snippet should embed hex payload');
  assert.ok(snippet.includes('0xabcd1234'), 'snippet should embed signature hash');
  console.log('✓ testFromBundleProducesRunnableSnippet');
}

function testFromBundleSnippetIsDeterministic(): void {
  const bundle: CaseBundleExport = {
    seedId: 7,
    inputPayloadHex: 'cafebabe',
    failureClass: 'empty-input',
    signatureHash: '0x0001',
    mode: 'contract',
  };
  assert.equal(
    generateTSReproducerFromBundle(bundle),
    generateTSReproducerFromBundle(bundle),
    'fromBundle output must be deterministic',
  );
  console.log('✓ testFromBundleSnippetIsDeterministic');
}

// ── formatReproducerDependencies ──────────────────────────────────────────────

function testFormatDepsDeduplicatesAndSorts(): void {
  const result = formatReproducerDependencies(['zebra', 'alpha', 'zebra', 'beta']);
  assert.equal(
    result,
    "import alpha from 'alpha';\nimport beta from 'beta';\nimport zebra from 'zebra';",
    'formatReproducerDependencies should deduplicate and sort',
  );
  console.log('✓ testFormatDepsDeduplicatesAndSorts');
}

function testFormatDepsEmptyArrayReturnsEmptyString(): void {
  assert.equal(formatReproducerDependencies([]), '', 'empty deps should return empty string');
  console.log('✓ testFormatDepsEmptyArrayReturnsEmptyString');
}

// ── run all tests ─────────────────────────────────────────────────────────────

testSnippetContainsTestName();
testSnippetContainsShouldReproduceLabel();
testSnippetIncludesExpectAssertion();
testDependenciesAreSortedAndImported();
testNoDependenciesProducesNoneComment();
testFrameworkImportPrepended();
testSkipIfEmitsItSkip();
testTimeoutArgAppended();
testOutputIsDeterministic();
testTestNameWithSingleQuoteIsEscaped();
testNullInputSerialises();
testFromBundleProducesRunnableSnippet();
testFromBundleSnippetIsDeterministic();
testFormatDepsDeduplicatesAndSorts();
testFormatDepsEmptyArrayReturnsEmptyString();

console.log('\nAll generate-ts-reproducer tests passed.');
