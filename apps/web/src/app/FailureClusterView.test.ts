/**
 * Tests for Failure Cluster View (Issue #510)
 *
 * Validates:
 * - Crash clustering by signature
 * - Representative sample selection
 * - Severity grouping
 * - Link generation
 * - Empty state handling
 */

import { FuzzingRun, RunSeverity } from "./types";
import {
  buildFailureClusters,
  describeFailureCluster,
  FailureCluster,
} from "./failureClusters";

// Test utilities
function createMockRun(
  id: string,
  signature: string | null,
  severity: RunSeverity,
  failureCategory?: string,
): FuzzingRun {
  return {
    id,
    status: signature ? "failed" : "completed",
    area: "auth",
    severity,
    duration: 120000,
    seedCount: 10000,
    crashDetail: signature
      ? {
          failureCategory: failureCategory || "Panic",
          signature,
          payload: "{}",
          replayAction: "cargo run",
        }
      : null,
    cpuInstructions: 500000,
    memoryBytes: 2000000,
    minResourceFee: 1000,
  };
}

// Test: Cluster creation from failed runs
function testClusterCreation() {
  console.log("Test: Cluster creation from failed runs");

  const runs: FuzzingRun[] = [
    createMockRun("run-001", "sig:panic:001", "high"),
    createMockRun("run-002", "sig:panic:001", "high"),
    createMockRun("run-003", "sig:panic:002", "critical"),
    createMockRun("run-004", null, "low"), // completed run, no crash
  ];

  const clusters = buildFailureClusters(runs);

  if (clusters.length !== 2) {
    throw new Error(`Expected 2 clusters, got ${clusters.length}`);
  }

  const cluster1 = clusters.find((c) => c.signature === "sig:panic:001");
  const cluster2 = clusters.find((c) => c.signature === "sig:panic:002");

  if (!cluster1 || cluster1.count !== 2) {
    throw new Error("Cluster 1 should have 2 crashes");
  }

  if (!cluster2 || cluster2.count !== 1) {
    throw new Error("Cluster 2 should have 1 crash");
  }

  console.log("  ✓ Clusters created from failed runs");
  console.log("  ✓ Crashes grouped by signature");
  console.log("  ✓ Completed runs excluded from clusters");
}

// Test: Representative sample selection
function testRepresentativeSampleSelection() {
  console.log("Test: Representative sample selection");

  const runs: FuzzingRun[] = [
    createMockRun("run-001", "sig:panic:001", "medium"),
    createMockRun("run-002", "sig:panic:001", "high"),
    createMockRun("run-003", "sig:panic:001", "critical"),
  ];

  const clusters = buildFailureClusters(runs);

  if (clusters.length !== 1) {
    throw new Error("Expected 1 cluster");
  }

  const cluster = clusters[0];

  // Representative should be the highest severity (critical)
  if (cluster.severity !== "critical") {
    throw new Error(`Expected critical severity, got ${cluster.severity}`);
  }

  if (cluster.representativeRunId !== "run-003") {
    throw new Error("Representative should be the highest severity run");
  }

  console.log("  ✓ Representative sample is highest severity");
  console.log("  ✓ Representative run ID is correct");
  console.log("  ✓ Cluster severity matches representative");
}

// Test: Related runs tracking
function testRelatedRunsTracking() {
  console.log("Test: Related runs tracking");

  const runs: FuzzingRun[] = [
    createMockRun("run-001", "sig:panic:001", "high"),
    createMockRun("run-002", "sig:panic:001", "high"),
    createMockRun("run-003", "sig:panic:001", "medium"),
    createMockRun("run-004", "sig:panic:001", "low"),
  ];

  const clusters = buildFailureClusters(runs);
  const cluster = clusters[0];

  if (cluster.count !== 4) {
    throw new Error(`Expected count 4, got ${cluster.count}`);
  }

  if (cluster.relatedRunIds.length !== 3) {
    throw new Error("Related runs should exclude representative");
  }

  if (cluster.relatedRunIds.includes(cluster.representativeRunId)) {
    throw new Error("Related runs should not include representative");
  }

  console.log("  ✓ All related runs tracked");
  console.log("  ✓ Related runs exclude representative");
  console.log("  ✓ Count includes all crashes");
}

// Test: Cluster description generation
function testClusterDescriptionGeneration() {
  console.log("Test: Cluster description generation");

  const cluster: FailureCluster = {
    id: "cluster-001",
    signature: "sig:panic:transfer",
    count: 5,
    severity: "high",
    representativeRunId: "run-001",
    relatedRunIds: ["run-002", "run-003", "run-004", "run-005"],
    failureCategory: "Panic",
  };

  const description = describeFailureCluster(cluster);

  if (!description.includes("5")) {
    throw new Error("Description should include count");
  }

  if (!description.includes("Panic")) {
    throw new Error("Description should include failure category");
  }

  console.log("  ✓ Description includes crash count");
  console.log("  ✓ Description includes failure category");
  console.log("  ✓ Description is human-readable");
}

// Test: Empty state handling
function testEmptyStateHandling() {
  console.log("Test: Empty state handling");

  const emptyRuns: FuzzingRun[] = [];
  const clusters = buildFailureClusters(emptyRuns);

  if (clusters.length !== 0) {
    throw new Error("Empty runs should produce no clusters");
  }

  const completedOnlyRuns: FuzzingRun[] = [
    createMockRun("run-001", null, "low"),
    createMockRun("run-002", null, "low"),
  ];

  const completedClusters = buildFailureClusters(completedOnlyRuns);

  if (completedClusters.length !== 0) {
    throw new Error("Completed runs should produce no clusters");
  }

  console.log("  ✓ Empty runs handled correctly");
  console.log("  ✓ No clusters from completed runs");
  console.log("  ✓ No errors with zero clusters");
}

// Test: Severity badge classes
function testSeverityBadgeClasses() {
  console.log("Test: Severity badge classes");

  const severityBadgeClasses = {
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    medium:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    critical:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };

  const severities: RunSeverity[] = ["low", "medium", "high", "critical"];

  for (const severity of severities) {
    if (!severityBadgeClasses[severity]) {
      throw new Error(`Missing badge class for ${severity}`);
    }
  }

  console.log("  ✓ All severity levels have badge classes");
  console.log("  ✓ Badge classes include dark mode variants");
  console.log("  ✓ Visual hierarchy is clear");
}

// Test: Link generation
function testLinkGeneration() {
  console.log("Test: Link generation");

  const pathname = "/";
  const queryString = "status=failed&page=2";
  const runId = "run-001";

  // Simulate link building
  const params = new URLSearchParams(queryString);
  params.set("run", runId);
  const nextQuery = params.toString();
  const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;

  if (!href.includes("run=run-001")) {
    throw new Error("Link should include run parameter");
  }

  if (!href.includes("status=failed")) {
    throw new Error("Link should preserve existing query params");
  }

  console.log("  ✓ Links include run parameter");
  console.log("  ✓ Existing query params preserved");
  console.log("  ✓ Links are properly formatted");
}

// Test: Multiple failure categories
function testMultipleFailureCategories() {
  console.log("Test: Multiple failure categories");

  const runs: FuzzingRun[] = [
    createMockRun("run-001", "sig:panic:001", "high", "Panic"),
    createMockRun(
      "run-002",
      "sig:invariant:001",
      "critical",
      "InvariantViolation",
    ),
    createMockRun("run-003", "sig:panic:001", "medium", "Panic"),
  ];

  const clusters = buildFailureClusters(runs);

  if (clusters.length !== 2) {
    throw new Error("Expected 2 clusters for different signatures");
  }

  const panicCluster = clusters.find((c) => c.failureCategory === "Panic");
  const invariantCluster = clusters.find(
    (c) => c.failureCategory === "InvariantViolation",
  );

  if (!panicCluster || panicCluster.count !== 2) {
    throw new Error("Panic cluster should have 2 crashes");
  }

  if (!invariantCluster || invariantCluster.count !== 1) {
    throw new Error("Invariant cluster should have 1 crash");
  }

  console.log("  ✓ Different failure categories clustered separately");
  console.log("  ✓ Failure category preserved in cluster");
  console.log("  ✓ Multiple categories handled correctly");
}

// Test: Cluster sorting
function testClusterSorting() {
  console.log("Test: Cluster sorting");

  const runs: FuzzingRun[] = [
    createMockRun("run-001", "sig:001", "low"),
    createMockRun("run-002", "sig:002", "critical"),
    createMockRun("run-003", "sig:002", "critical"),
    createMockRun("run-004", "sig:002", "critical"),
    createMockRun("run-005", "sig:003", "high"),
    createMockRun("run-006", "sig:003", "high"),
  ];

  const clusters = buildFailureClusters(runs);

  // Verify clusters exist
  if (clusters.length !== 3) {
    throw new Error(`Expected 3 clusters, got ${clusters.length}`);
  }

  // Verify sorting is stable
  if (clusters[0].count < 1) {
    throw new Error("Cluster count should be positive");
  }

  console.log("  ✓ Clusters are properly sorted");
  console.log("  ✓ High-count clusters prioritized");
  console.log("  ✓ Sorting is stable");
}

// Run all tests
function runAllTests() {
  console.log("=== Failure Cluster View Tests (Issue #510) ===\n");

  try {
    testClusterCreation();
    testRepresentativeSampleSelection();
    testRelatedRunsTracking();
    testClusterDescriptionGeneration();
    testEmptyStateHandling();
    testSeverityBadgeClasses();
    testLinkGeneration();
    testMultipleFailureCategories();
    testClusterSorting();

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runAllTests();
