# CaseBundle Upload Validation API

**Issue:** ROADMAP-122  
**Branch:** `issue/122-bundle-schema-validation-api`

## Overview

This API endpoint validates uploaded `CaseBundle` JSON documents against the canonical schema defined in `crashlab-core`. It performs both **structural validation** (Zod schema) and **semantic validation** (seed constraints, signature categories, environment fingerprints).

## Endpoint

POST /api/artifacts/validate

### Request Body

```json
{
  "bundle": {
    "schema": 2,
    "seed": {
      "id": 42,
      "payload": [1, 2, 3]
    },
    "signature": {
      "category": "auth",
      "digest": 123,
      "signature_hash": 456
    },
    "environment": {
      "os": "linux",
      "arch": "x86_64",
      "family": "unix",
      "version": "1.0.0"
    },
    "failure_payload": [222, 173, 190, 239]
  }
}

| Field                             | Required                    | Description                                                                  |
| --------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `bundle.schema`                   | Yes (for versioned bundles) | Must equal `2` (current `CASE_BUNDLE_SCHEMA_VERSION`)                        |
| `bundle.seed.id`                  | Yes                         | Non-negative integer                                                         |
| `bundle.seed.payload`             | Yes                         | Byte array (`0–255`), length `1–64`                                          |
| `bundle.signature.category`       | Yes                         | Failure class: `auth`, `budget`, `state`, `xdr`, or legacy `runtime-failure` |
| `bundle.signature.digest`         | Yes                         | 64-bit FNV-1a hash                                                           |
| `bundle.signature.signature_hash` | Yes                         | Deterministic artifact hash                                                  |
| `bundle.environment`              | No                          | OS/arch/family/version fingerprint for replay checks                         |
| `bundle.failure_payload`          | No                          | Optional diagnostic bytes                                                    |
| `bundle.rpc_envelope`             | No                          | Optional RPC capture for replay auditing                                     |


Response
200 OK — Valid bundle:
{
  "valid": true,
  "schemaVersion": 2,
  "errors": [],
  "warnings": [],
  "seed": { "id": 42, "payloadLength": 3 },
  "signature": { "category": "auth", "digest": 123, "signatureHash": 456 },
  "environment": { "os": "linux", "arch": "x86_64", "family": "unix", "version": "1.0.0" }
}

422 Unprocessable Entity — Schema or constraint violations:
{
  "valid": false,
  "errors": ["Schema violation at schema: Invalid literal value, expected 2"],
  "warnings": []
}

400 Bad Request — Invalid JSON or missing bundle field.
413 Payload Too Large — Body exceeds 1 MiB.
Validation Rules
Structural (Zod Schema)
schema must be exactly 2 for versioned bundles.
seed.id must be a non-negative integer.
seed.payload must be an array of bytes (0–255), max length 64.
signature fields must be present and non-empty.
Legacy bundles (no schema field) are accepted with a warning.
Semantic (Seed Constraints)
Payload length must be between 1 and 64 bytes (mirrors SeedSchema in crashlab-core).
Seed ID must not exceed Number.MAX_SAFE_INTEGER.
Warnings (Non-blocking)
Null bytes in payload: Contracts interpreting payloads as C-strings may truncate at 0x00.
Unknown signature category: Helps detect typos or new unregistered categories.
Missing environment fingerprint: Replay environment checks will be skipped.
Legacy bundle: Missing schema field; recommend re-exporting with current crashlab-core.
Security Considerations
Size limit: Request bodies are capped at 1 MiB to prevent memory exhaustion.
No path traversal: The API does not write to disk; it only validates in-memory.
Adversarial input: All fields are treated as untrusted. Zod schema validation prevents injection of non-numeric types or oversized arrays.

Testing
Unit Tests
cd apps/web
npx vitest run src/app/api/artifacts/validate/route.test.ts

Integration Tests
cd apps/web
npx vitest run src/app/api/artifacts/validate/route.integration.test.tsHere are all the code files written out in full:
apps/web/src/app/api/artifacts/validate/route.ts
TypeScript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * CaseBundle schema version constant.
 * Must match CASE_BUNDLE_SCHEMA_VERSION in crashlab-core.
 */
export const CASE_BUNDLE_SCHEMA_VERSION = 2;

/**
 * Zod schema for a CaseSeed.
 * seed.id: non-negative integer identifier
 * seed.payload: byte array (0–64 bytes, configurable)
 */
const CaseSeedSchema = z.object({
  id: z.number().int().nonnegative(),
  payload: z.array(z.number().int().min(0).max(255)).max(64),
});

/**
 * Zod schema for a CrashSignature.
 * category: stable failure class or legacy "runtime-failure"
 * digest: 64-bit FNV-1a hash
 * signature_hash: deterministic hash for artifact naming
 */
const CrashSignatureSchema = z.object({
  category: z.string().min(1),
  digest: z.number().int(),
  signature_hash: z.number().int(),
});

/**
 * Zod schema for EnvironmentFingerprint (optional).
 * Captures OS, CPU architecture, platform family, and tool version at bundle creation time.
 */
const EnvironmentFingerprintSchema = z.object({
  os: z.string().min(1),
  arch: z.string().min(1),
  family: z.string().min(1),
  version: z.string().min(1),
});

/**
 * Zod schema for a CaseBundle.
 * Top-level schema field is mandatory for versioned documents.
 * seed and signature are required.
 * environment and failure_payload are optional.
 */
const CaseBundleSchema = z.object({
  schema: z.literal(CASE_BUNDLE_SCHEMA_VERSION),
  seed: CaseSeedSchema,
  signature: CrashSignatureSchema,
  environment: EnvironmentFingerprintSchema.nullable().optional(),
  failure_payload: z.array(z.number().int().min(0).max(255)).optional(),
  rpc_envelope: z.record(z.unknown()).optional(),
});

/**
 * Union type allowing both versioned (schema field) and legacy bundles.
 * Legacy bundles lack the schema field but must still contain seed + signature.
 */
const LegacyCaseBundleSchema = z.object({
  seed: CaseSeedSchema,
  signature: CrashSignatureSchema,
  environment: EnvironmentFingerprintSchema.nullable().optional(),
  failure_payload: z.array(z.number().int().min(0).max(255)).optional(),
});

const AcceptedCaseBundleSchema = z.union([
  CaseBundleSchema,
  LegacyCaseBundleSchema,
]);

/**
 * Seed validation constraints (mirrors SeedSchema in crashlab-core).
 */
const SEED_CONSTRAINTS = {
  minPayloadLength: 1,
  maxPayloadLength: 64,
  maxId: Number.MAX_SAFE_INTEGER,
};

/**
 * Validation result type returned to clients.
 */
export interface ValidationResult {
  valid: boolean;
  schemaVersion?: number;
  errors: string[];
  warnings: string[];
  seed?: {
    id: number;
    payloadLength: number;
  };
  signature?: {
    category: string;
    digest: number;
    signatureHash: number;
  };
  environment?: {
    os: string;
    arch: string;
    family: string;
    version: string;
  } | null;
}

/**
 * Validate a raw JSON object against the CaseBundle schema and seed constraints.
 *
 * @param data - Parsed JSON object from the request body.
 * @returns ValidationResult with detailed errors, warnings, and extracted fields.
 */
export function validateCaseBundle(data: unknown): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    errors: [],
    warnings: [],
  };

  // 1. Schema-level validation (Zod)
  const parseResult = AcceptedCaseBundleSchema.safeParse(data);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    for (const issue of issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      result.errors.push(`Schema violation at ${path}: ${issue.message}`);
    }
    return result;
  }

  const bundle = parseResult.data;

  // 2. Seed constraint validation (mirrors crashlab-core SeedSchema)
  const payload = bundle.seed.payload;
  if (payload.length < SEED_CONSTRAINTS.minPayloadLength) {
    result.errors.push(
      `Seed payload too short: ${payload.length} bytes (minimum ${SEED_CONSTRAINTS.minPayloadLength})`
    );
  }
  if (payload.length > SEED_CONSTRAINTS.maxPayloadLength) {
    result.errors.push(
      `Seed payload too long: ${payload.length} bytes (maximum ${SEED_CONSTRAINTS.maxPayloadLength})`
    );
  }
  if (bundle.seed.id > SEED_CONSTRAINTS.maxId) {
    result.errors.push(
      `Seed ID exceeds safe integer range: ${bundle.seed.id}`
    );
  }

  // 3. Null-byte warning (known gap documented in crashlab-core)
  if (payload.includes(0)) {
    result.warnings.push(
      "Seed payload contains null bytes (0x00). Contracts interpreting payloads as C-style strings may be vulnerable to truncation or injection."
    );
  }

  // 4. Signature category validation
  const validCategories = [
    "auth",
    "budget",
    "state",
    "xdr",
    "runtime-failure", // legacy
  ];
  if (!validCategories.includes(bundle.signature.category)) {
    result.warnings.push(
      `Unknown signature category "${bundle.signature.category}". Expected one of: ${validCategories.join(", ")}.`
    );
  }

  // 5. Schema version tracking
  if ("schema" in bundle) {
    result.schemaVersion = bundle.schema;
  } else {
    result.warnings.push(
      "Legacy bundle detected (missing schema field). Consider re-exporting with the current crashlab-core version for full compatibility."
    );
  }

  // 6. Environment fingerprint validation (if present)
  if (bundle.environment) {
    result.environment = {
      os: bundle.environment.os,
      arch: bundle.environment.arch,
      family: bundle.environment.family,
      version: bundle.environment.version,
    };
  } else {
    result.environment = null;
    result.warnings.push(
      "No environment fingerprint present. Replay environment checks will be skipped."
    );
  }

  // 7. Populate extracted fields
  result.seed = {
    id: bundle.seed.id,
    payloadLength: payload.length,
  };
  result.signature = {
    category: bundle.signature.category,
    digest: bundle.signature.digest,
    signatureHash: bundle.signature.signature_hash,
  };

  // Final validity: valid only if no errors
  result.valid = result.errors.length === 0;
  return result;
}

/**
 * POST /api/artifacts/validate
 *
 * Accepts a JSON body containing a CaseBundle and returns a detailed validation report.
 *
 * Request body: { "bundle": <CaseBundle> }
 * Response: 200 OK with ValidationResult JSON
 *           400 Bad Request if body is not valid JSON or missing bundle field
 *           413 Payload Too Large if body exceeds 1 MiB
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Size guard: reject bodies > 1 MiB to prevent memory exhaustion
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > 1024 * 1024) {
      return NextResponse.json(
        {
          valid: false,
          errors: ["Request body exceeds 1 MiB limit."],
          warnings: [],
        },
        { status: 413 }
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        valid: false,
        errors: ["Invalid JSON in request body."],
        warnings: [],
      },
      { status: 400 }
    );
  }

  // Expect { bundle: <CaseBundle> }
  if (!body || typeof body !== "object" || !("bundle" in body)) {
    return NextResponse.json(
      {
        valid: false,
        errors: ['Missing "bundle" field in request body.'],
        warnings: [],
      },
      { status: 400 }
    );
  }

  const bundle = (body as Record<string, unknown>).bundle;
  const result = validateCaseBundle(bundle);

  const status = result.valid ? 200 : 422;
  return NextResponse.json(result, { status });
}
apps/web/src/app/api/artifacts/validate/route.test.ts
TypeScript
import { describe, it, expect } from "vitest";
import { validateCaseBundle, CASE_BUNDLE_SCHEMA_VERSION } from "./route";

/**
 * Helper to build a minimal valid CaseBundle.
 */
function makeValidBundle(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    schema: CASE_BUNDLE_SCHEMA_VERSION,
    seed: { id: 42, payload: [1, 2, 3] },
    signature: { category: "auth", digest: 123, signature_hash: 456 },
    ...overrides,
  };
}

describe("validateCaseBundle", () => {
  // ─────────────────────────────────────────
  // Happy path
  // ─────────────────────────────────────────
  it("accepts a fully valid versioned bundle", () => {
    const bundle = makeValidBundle();
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.schemaVersion).toBe(CASE_BUNDLE_SCHEMA_VERSION);
    expect(result.seed).toEqual({ id: 42, payloadLength: 3 });
    expect(result.signature).toEqual({ category: "auth", digest: 123, signatureHash: 456 });
    expect(result.environment).toBeNull();
  });

  it("accepts a valid legacy bundle (no schema field)", () => {
    const bundle = makeValidBundle();
    delete (bundle as Record<string, unknown>).schema;
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.schemaVersion).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Legacy bundle detected"),
      ])
    );
  });

  it("accepts a bundle with an environment fingerprint", () => {
    const bundle = makeValidBundle({
      environment: { os: "linux", arch: "x86_64", family: "unix", version: "1.0.0" },
    });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.environment).toEqual({
      os: "linux",
      arch: "x86_64",
      family: "unix",
      version: "1.0.0",
    });
  });

  it("accepts a bundle with failure_payload", () => {
    const bundle = makeValidBundle({ failure_payload: [0xde, 0xad, 0xbe, 0xef] });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a bundle with rpc_envelope", () => {
    const bundle = makeValidBundle({ rpc_envelope: { method: "simulateTransaction" } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ─────────────────────────────────────────
  // Schema violations
  // ─────────────────────────────────────────
  it("rejects missing seed", () => {
    const bundle = makeValidBundle();
    delete (bundle as Record<string, unknown>).seed;
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("seed"))).toBe(true);
  });

  it("rejects missing signature", () => {
    const bundle = makeValidBundle();
    delete (bundle as Record<string, unknown>).signature;
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("signature"))).toBe(true);
  });

  it("rejects wrong schema version", () => {
    const bundle = makeValidBundle({ schema: 99 });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schema"))).toBe(true);
  });

  it("rejects negative seed id", () => {
    const bundle = makeValidBundle({ seed: { id: -1, payload: [1] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("rejects non-integer seed id", () => {
    const bundle = makeValidBundle({ seed: { id: 3.14, payload: [1] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("id"))).toBe(true);
  });

  it("rejects payload with values outside byte range", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: [256] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("payload"))).toBe(true);
  });

  it("rejects payload with negative byte values", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: [-1] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("payload"))).toBe(true);
  });

  it("rejects oversized payload", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: new Array(65).fill(1) } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("payload"))).toBe(true);
  });

  it("rejects empty signature category", () => {
    const bundle = makeValidBundle({ signature: { category: "", digest: 1, signature_hash: 1 } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("category"))).toBe(true);
  });

  // ─────────────────────────────────────────
  // Seed constraint violations
  // ─────────────────────────────────────────
  it("rejects payload shorter than 1 byte", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: [] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too short"))).toBe(true);
  });

  it("rejects payload longer than 64 bytes", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: new Array(65).fill(1) } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too long"))).toBe(true);
  });

  // ─────────────────────────────────────────
  // Warnings
  // ─────────────────────────────────────────
  it("warns about null bytes in payload", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: [0x00, 0x01] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("null bytes"))).toBe(true);
  });

  it("warns about unknown signature category", () => {
    const bundle = makeValidBundle({ signature: { category: "unknown", digest: 1, signature_hash: 1 } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("Unknown signature category"))).toBe(true);
  });

  it("warns about missing environment fingerprint", () => {
    const bundle = makeValidBundle();
    delete (bundle as Record<string, unknown>).environment;
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("environment fingerprint"))).toBe(true);
  });

  // ─────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────
  it("handles null input gracefully", () => {
    const result = validateCaseBundle(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles non-object input gracefully", () => {
    const result = validateCaseBundle("not-an-object");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles empty object input gracefully", () => {
    const result = validateCaseBundle({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts exactly 64-byte payload boundary", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: new Array(64).fill(1) } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.seed?.payloadLength).toBe(64);
  });

  it("accepts exactly 1-byte payload boundary", () => {
    const bundle = makeValidBundle({ seed: { id: 1, payload: [0xab] } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.seed?.payloadLength).toBe(1);
  });

  it("accepts legacy runtime-failure category", () => {
    const bundle = makeValidBundle({ signature: { category: "runtime-failure", digest: 1, signature_hash: 1 } });
    const result = validateCaseBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0); // runtime-failure is a known legacy category
  });

  it("accepts all stable failure categories without warnings", () => {
    const categories = ["auth", "budget", "state", "xdr"];
    for (const category of categories) {
      const bundle = makeValidBundle({ signature: { category, digest: 1, signature_hash: 1 } });
      const result = validateCaseBundle(bundle);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    }
  });
});
apps/web/src/app/api/artifacts/validate/route.integration.test.ts
TypeScript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/artifacts/validate", () => {
  /**
   * Helper to build a NextRequest with a JSON body.
   */
  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest("http://localhost/api/artifacts/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 200 for a valid bundle", async () => {
    const request = makeRequest({
      bundle: {
        schema: 2,
        seed: { id: 1, payload: [1, 2, 3] },
        signature: { category: "auth", digest: 123, signature_hash: 456 },
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.valid).toBe(true);
    expect(json.errors).toHaveLength(0);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/artifacts/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.errors[0]).toContain("Invalid JSON");
  });

  it("returns 400 for missing bundle field", async () => {
    const request = makeRequest({ notBundle: {} });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.errors[0]).toContain('Missing "bundle"');
  });

  it("returns 422 for schema-invalid bundle", async () => {
    const request = makeRequest({
      bundle: {
        schema: 99, // wrong version
        seed: { id: 1, payload: [1] },
        signature: { category: "auth", digest: 1, signature_hash: 1 },
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.errors.length).toBeGreaterThan(0);
  });

  it("returns 413 for oversized body", async () => {
    const request = new NextRequest("http://localhost/api/artifacts/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "2097152", // 2 MiB
      },
      body: JSON.stringify({ bundle: {} }),
    });
    const response = await POST(request);
    expect(response.status).toBe(413);
    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.errors[0]).toContain("1 MiB");
  });

  it("returns 422 for payload with constraint violations", async () => {
    const request = makeRequest({
      bundle: {
        schema: 2,
        seed: { id: 1, payload: [] }, // empty payload — too short
        signature: { category: "auth", digest: 1, signature_hash: 1 },
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.valid).toBe(false);
    expect(json.errors.some((e: string) => e.includes("too short"))).toBe(true);
  });
});
.github/workflows/validate-casebundle.yml
yaml
name: Validate CaseBundle CI

on:
  push:
    branches: [main, issue/122-bundle-schema-validation-api]
    paths:
      - "apps/web/src/app/api/artifacts/validate/**"
      - ".github/workflows/validate-casebundle.yml"
  pull_request:
    branches: [main]
    paths:
      - "apps/web/src/app/api/artifacts/validate/**"
      - ".github/workflows/validate-casebundle.yml"

jobs:
  test:
    name: Test CaseBundle Validation API
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"
          cache-dependency-path: apps/web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npx vitest run src/app/api/artifacts/validate/route.test.ts

      - name: Run integration tests
        run: npx vitest run src/app/api/artifacts/validate/route.integration.test.ts

      - name: Run linter
        run: npm run lint -- src/app/api/artifacts/validate/

      - name: Type check
        run: npx tsc --noEmit src/app/api/artifacts/validate/route.ts
apps/web/src/app/api/artifacts/validate/README.md
Markdown
Copy
Code
Preview
# CaseBundle Upload Validation API

**Issue:** ROADMAP-122  
**Branch:** `issue/122-bundle-schema-validation-api`

## Overview

This API endpoint validates uploaded `CaseBundle` JSON documents against the canonical schema defined in `crashlab-core`. It performs both **structural validation** (Zod schema) and **semantic validation** (seed constraints, signature categories, environment fingerprints).

## Endpoint
POST /api/artifacts/validate
plain

### Request Body

```json
{
  "bundle": {
    "schema": 2,
    "seed": {
      "id": 42,
      "payload": [1, 2, 3]
    },
    "signature": {
      "category": "auth",
      "digest": 123,
      "signature_hash": 456
    },
    "environment": {
      "os": "linux",
      "arch": "x86_64",
      "family": "unix",
      "version": "1.0.0"
    },
    "failure_payload": [222, 173, 190, 239]
  }
}
Table
Field	Required	Description
bundle.schema	Yes (for versioned bundles)	Must equal 2 (current CASE_BUNDLE_SCHEMA_VERSION)
bundle.seed.id	Yes	Non-negative integer
bundle.seed.payload	Yes	Byte array (0–255), length 1–64
bundle.signature.category	Yes	Failure class: auth, budget, state, xdr, or legacy runtime-failure
bundle.signature.digest	Yes	64-bit FNV-1a hash
bundle.signature.signature_hash	Yes	Deterministic artifact hash
bundle.environment	No	OS/arch/family/version fingerprint for replay checks
bundle.failure_payload	No	Optional diagnostic bytes
bundle.rpc_envelope	No	Optional RPC capture for replay auditing
Response
200 OK — Valid bundle:
JSON
{
  "valid": true,
  "schemaVersion": 2,
  "errors": [],
  "warnings": [],
  "seed": { "id": 42, "payloadLength": 3 },
  "signature": { "category": "auth", "digest": 123, "signatureHash": 456 },
  "environment": { "os": "linux", "arch": "x86_64", "family": "unix", "version": "1.0.0" }
}
422 Unprocessable Entity — Schema or constraint violations:
JSON
{
  "valid": false,
  "errors": ["Schema violation at schema: Invalid literal value, expected 2"],
  "warnings": []
}
400 Bad Request — Invalid JSON or missing bundle field.
413 Payload Too Large — Body exceeds 1 MiB.
Validation Rules
Structural (Zod Schema)
schema must be exactly 2 for versioned bundles.
seed.id must be a non-negative integer.
seed.payload must be an array of bytes (0–255), max length 64.
signature fields must be present and non-empty.
Legacy bundles (no schema field) are accepted with a warning.
Semantic (Seed Constraints)
Payload length must be between 1 and 64 bytes (mirrors SeedSchema in crashlab-core).
Seed ID must not exceed Number.MAX_SAFE_INTEGER.
Warnings (Non-blocking)
Null bytes in payload: Contracts interpreting payloads as C-strings may truncate at 0x00.
Unknown signature category: Helps detect typos or new unregistered categories.
Missing environment fingerprint: Replay environment checks will be skipped.
Legacy bundle: Missing schema field; recommend re-exporting with current crashlab-core.
Security Considerations
Size limit: Request bodies are capped at 1 MiB to prevent memory exhaustion.
No path traversal: The API does not write to disk; it only validates in-memory.
Adversarial input: All fields are treated as untrusted. Zod schema validation prevents injection of non-numeric types or oversized arrays.
Testing
Unit Tests
bash
cd apps/web
npx vitest run src/app/api/artifacts/validate/route.test.ts
Integration Tests
bash
cd apps/web
npx vitest run src/app/api/artifacts/validate/route.integration.test.ts


CI
The .github/workflows/validate-casebundle.yml workflow runs on every push/PR touching the validation route. It executes:
npm ci
Unit tests
Integration tests
ESLint
TypeScript type check

Files Changed| File                                                                | Action                          |
| ------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/app/api/artifacts/validate/route.ts`                  | **New** — Main validation logic |
| `apps/web/src/app/api/artifacts/validate/route.test.ts`             | **New** — Unit tests            |
| `apps/web/src/app/api/artifacts/validate/route.integration.test.ts` | **New** — Integration tests     |
| `.github/workflows/validate-casebundle.yml`                         | **New** — CI workflow           |


Dependencies
zod — Runtime schema validation (already used elsewhere in apps/web)
next/server — Next.js App Router API routes (existing)
vitest — Test runner (existing dev dependency)
No new production dependencies were added.