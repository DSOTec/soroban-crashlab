import { NextRequest, NextResponse } from 'next/server';
import { buildMockRuns } from '@/app/mockRuns';

// In-memory store keyed by run ID (persists for the lifetime of the process)
const annotationStore = new Map<string, string[]>();

function getAnnotations(id: string): string[] {
  if (annotationStore.has(id)) {
    return annotationStore.get(id)!;
  }
  // Seed from mock data on first access
  const run = buildMockRuns().find((r) => r.id === id);
  const initial = run?.annotations ?? [];
  annotationStore.set(id, [...initial]);
  return annotationStore.get(id)!;
}

/**
 * GET /api/runs/[id]/annotations
 * Returns the current annotation list for a run.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = buildMockRuns().find((r) => r.id === id);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }
  return NextResponse.json({ runId: id, annotations: getAnnotations(id) });
}

/**
 * POST /api/runs/[id]/annotations
 * Appends a new annotation. Body: { text: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = buildMockRuns().find((r) => r.id === id);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const text = (body as Record<string, unknown>)?.text;
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text is required and must be a non-empty string' }, { status: 400 });
  }
  if (text.trim().length > 500) {
    return NextResponse.json({ error: 'Annotation exceeds 500 character limit' }, { status: 400 });
  }

  const annotations = getAnnotations(id);
  annotations.push(text.trim());
  return NextResponse.json({ runId: id, annotations }, { status: 201 });
}

/**
 * DELETE /api/runs/[id]/annotations
 * Removes an annotation by index. Body: { index: number }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = buildMockRuns().find((r) => r.id === id);
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const index = (body as Record<string, unknown>)?.index;
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    return NextResponse.json({ error: 'index must be an integer' }, { status: 400 });
  }

  const annotations = getAnnotations(id);
  if (index < 0 || index >= annotations.length) {
    return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
  }

  annotations.splice(index, 1);
  return NextResponse.json({ runId: id, annotations });
}
