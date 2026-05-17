import { formatVerified, validateAuthProvider, simulateAuthProbe, AuthProvider, AuthProviderType } from './integrate-external-authentication-integration-utils';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testFormatVerified(): void {
  const dateStr = "2026-03-28T08:14:00Z";
  const formatted = formatVerified(dateStr);
  assert(formatted.startsWith("Verified "), "Should start with Verified");
  
  assert(formatVerified("") === "", "Empty string should return empty string");
  assert(formatVerified(undefined) === "", "Undefined should return empty string");
  assert(formatVerified("invalid-date") === "", "Invalid date should return empty string");
  
  console.log("✓ testFormatVerified passed");
}

function testValidateAuthProvider(): void {
  const validConnected: AuthProvider = {
    id: "prov-1",
    type: "oauth",
    label: "OAuth",
    description: "desc",
    status: "connected",
    identity: "user@example.com",
    lastVerified: new Date().toISOString()
  };
  
  const result1 = validateAuthProvider(validConnected);
  assert(result1.isValid, "Valid connected provider should pass");
  
  const invalidConnected: AuthProvider = {
    ...validConnected,
    identity: undefined
  };
  const result2 = validateAuthProvider(invalidConnected);
  assert(!result2.isValid, "Connected provider missing identity should fail");
  assert(result2.errors.includes("Identity is required when connected"), "Should have specific error for missing identity");
  
  const errorProvider: AuthProvider = {
    id: "prov-2",
    type: "api-key",
    label: "API",
    description: "desc",
    status: "error"
  };
  const result3 = validateAuthProvider(errorProvider);
  assert(!result3.isValid, "Error provider missing errorMessage should fail");
  assert(result3.errors.includes("Error message is required when status is error"), "Should have specific error for missing error message");
  
  const invalidType: AuthProvider = {
    id: "prov-3",
    type: "invalid-type" as unknown as AuthProviderType,
    label: "Invalid",
    description: "desc",
    status: "disconnected"
  };
  const result4 = validateAuthProvider(invalidType);
  assert(!result4.isValid, "Invalid provider type should fail");
  
  console.log("✓ testValidateAuthProvider passed");
}

function testSimulateAuthProbe(): void {
  const enforceResult = simulateAuthProbe('Enforce');
  assert(enforceResult.status === 'ok', "Enforce should be ok");
  
  const recordResult = simulateAuthProbe('Record');
  assert(recordResult.status === 'diverged', "Record should be diverged");
  
  const recordAllowNonrootResult = simulateAuthProbe('RecordAllowNonroot');
  assert(recordAllowNonrootResult.status === 'ok', "RecordAllowNonroot should be ok");
  
  console.log("✓ testSimulateAuthProbe passed");
}

function runAllTests(): void {
  console.log("Running External Authentication Integration Utils Tests...\n");
  
  try {
    testFormatVerified();
    testValidateAuthProvider();
    testSimulateAuthProbe();
    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}
