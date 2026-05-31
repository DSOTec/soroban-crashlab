import React from 'react';
import CIIntegrationForRunReplayTests from '../../integrate-ci-integration-for-run-replay-tests';

export const metadata = {
  title: 'CI Replay Integration | SorobanCrashLab',
  description: 'Dashboard panel for dispatching and inspecting CI pipeline replay tests for fuzzing seeds.',
};

export default function CIReplayIntegrationPage() {
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <CIIntegrationForRunReplayTests />
    </div>
  );
}