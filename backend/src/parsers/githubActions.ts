import YAML from 'yaml';
import { Pipeline, PipelineJob, PipelineStep } from '../types/pipeline';

export class GitHubActionsParser {
  parse(rawYaml: string): Pipeline {
    const parsed = YAML.parse(rawYaml);
    const jobs: PipelineJob[] = [];

    if (parsed && parsed.jobs) {
      for (const [jobId, jobData] of Object.entries(parsed.jobs)) {
        const anyJobData = jobData as any;
        const steps: PipelineStep[] = [];

        if (anyJobData.steps && Array.isArray(anyJobData.steps)) {
          for (const step of anyJobData.steps) {
            steps.push({
              name: step.name,
              uses: step.uses,
              run: step.run,
              env: step.env,
              with: step.with,
            });
          }
        }

        jobs.push({
          id: jobId,
          name: anyJobData.name || jobId,
          runsOn: anyJobData['runs-on'],
          steps: steps,
          needs: anyJobData.needs ? (Array.isArray(anyJobData.needs) ? anyJobData.needs : [anyJobData.needs]) : undefined,
        });
      }
    }

    return {
      name: parsed?.name,
      provider: 'github',
      jobs,
      rawYaml,
    };
  }
}
