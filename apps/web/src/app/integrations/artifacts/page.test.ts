import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const appRoot = path.resolve(__dirname);
const componentPath = path.resolve(appRoot, 'page.tsx');

const runAssertions = (): void => {
  if (!fs.existsSync(componentPath)) {
    throw new Error(`Component file not found at: ${componentPath}`);
  }

  const content = fs.readFileSync(componentPath, 'utf-8');

  assert.ok(
    content.includes("import ArtifactStorageIntegration from '../../integrate-storage-backend-integration-for-artifacts'"),
    'Page should import the ArtifactStorageIntegration wrapper component',
  );
  assert.ok(
    content.includes('export default function ArtifactStorageIntegrationPage()'),
    'Page should export a default page component',
  );
  assert.ok(
    content.includes('<ArtifactStorageIntegration />'),
    'Page should render the ArtifactStorageIntegration component',
  );

  console.log('integrations/artifacts/page.test.ts: all assertions passed');
};

runAssertions();
