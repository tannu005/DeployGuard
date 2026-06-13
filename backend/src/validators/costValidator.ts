import { Pipeline, CostIssue } from '../types/pipeline';

export class CostValidator {
  validate(pipeline: Pipeline): CostIssue[] {
    const issues: CostIssue[] = [];

    const usesMacOs = pipeline.jobs.some(job => job.runsOn?.includes('macos'));
    if (usesMacOs) {
      issues.push({
        type: 'EXPENSIVE_RUNNER',
        ruleId: 'COST-001',
        severity: 'MEDIUM',
        message: 'macOS runners are significantly more expensive than Ubuntu runners (usually 10x).',
        description: 'macOS runners are significantly more expensive than Ubuntu runners (usually 10x).',
        fix: 'Use ubuntu-latest unless iOS/macOS builds are specifically required.',
        suggestion: 'Use ubuntu-latest unless iOS/macOS builds are specifically required.'
      });
    }

    const hasTimeout = pipeline.rawYaml.includes('timeout-minutes');
    if (!hasTimeout) {
      issues.push({
        type: 'MISSING_TIMEOUT',
        ruleId: 'COST-002',
        severity: 'HIGH',
        message: 'No timeout-minutes specified. A hanging job could consume excessive CI minutes.',
        description: 'No timeout-minutes specified. A hanging job could consume excessive CI minutes.',
        fix: 'Add timeout-minutes: 15 (or appropriate limit) to all jobs.',
        suggestion: 'Add timeout-minutes: 15 (or appropriate limit) to all jobs.'
      });
    }

    return issues;
  }
}
