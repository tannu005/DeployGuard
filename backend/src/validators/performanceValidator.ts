import { Pipeline, PerformanceIssue } from '../types/pipeline';

export class PerformanceValidator {
  validate(pipeline: Pipeline): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    
    if (pipeline.jobs.length > 1 && !this.canParallelize(pipeline)) {
      issues.push({
        type: 'SEQUENTIAL_JOBS',
        severity: 'MEDIUM',
        message: `Jobs run sequentially. Parallelizing could save significant execution time.`,
        fix: 'Use job dependencies to parallelize: `needs: [job1]` where applicable, or remove needs if independent.'
      });
    }

    const hasCache = pipeline.jobs.some(job => 
      job.steps.some(step => step.uses?.includes('actions/cache') || step.uses?.includes('setup-node'))
    );
    
    if (!hasCache) {
      issues.push({
        type: 'MISSING_CACHE',
        severity: 'HIGH',
        message: 'No caching strategy detected. Dependency installation will be slow.',
        fix: 'Add actions/cache or use package manager caching in setup actions.'
      });
    }
    
    return issues;
  }

  private canParallelize(pipeline: Pipeline): boolean {
    let sequentialCount = 0;
    for (const job of pipeline.jobs) {
      if (job.needs && job.needs.length > 0) {
        sequentialCount++;
      }
    }
    return sequentialCount < pipeline.jobs.length - 1;
  }
}
