import { NextRequest, NextResponse } from 'next/server';
import { buildMockRuns } from '@/app/mockRuns';

// In-memory store keyed by run ID (persists for the lifetime of the process)
const tagStore = new Map<string, string[]>();

function normTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

function getTags(id: string): string[] {
  if (!tagStore.has(id)) {
    tagStore.set(id, []);
  }
  return tagStore.get(id)!;
}

/**
 * GET /api/runs/[id]/tags
 * Returns the current tag list for a run.
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
  return NextResponse.json({ runId: id, tags: getTags(id) });
}

/**
 * POST /api/runs/[id]/tags
 * Adds a tag (normalized to kebab-case). Body: { tag: string }
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

  const raw = (body as Record<string, unknown>)?.tag;
  if (typeof raw !== 'string' || !raw.trim()) {
    return NextResponse.json({ error: 'tag is required and must be a non-empty string' }, { status: 400 });
  }

  const tag = normTag(raw);
  if (tag.length > 64) {
    return NextResponse.json({ error: 'Tag exceeds 64 character limit' }, { status: 400 });
  }

  const tags = getTags(id);
  if (!tags.includes(tag)) {
    tags.push(tag);
    tags.sort();
  }
  return NextResponse.json({ runId: id, tags }, { status: 201 });
}

/**
 * DELETE /api/runs/[id]/tags
 * Removes a tag by value. Body: { tag: string }
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

  const raw = (body as Record<string, unknown>)?.tag;
  if (typeof raw !== 'string' || !raw.trim()) {
    return NextResponse.json({ error: 'tag is required' }, { status: 400 });
  }

  const tag = normTag(raw);
  const tags = getTags(id);
  const idx = tags.indexOf(tag);
  if (idx === -1) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  tags.splice(idx, 1);
  return NextResponse.json({ runId: id, tags });
}
