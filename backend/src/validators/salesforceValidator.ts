import { Pipeline, PipelineIssue } from '../types/pipeline';

export class SalesforceValidator {
  validate(pipeline: Pipeline): PipelineIssue[] {
    const issues: PipelineIssue[] = [];

    // Enterprise DevOps focuses on Salesforce deployments. We look for SFDX or SF CLI commands.
    const sfCommandsRegex = /(?:sfdx|sf)\s+([a-zA-Z0-9:]+)/g;

    for (const job of pipeline.jobs) {
      for (const step of job.steps) {
        if (!step.run) continue;

        const commandStr = step.run.toLowerCase();
        
        // 1. Detect missing test levels in deployments
        if (commandStr.includes('force:source:deploy') || commandStr.includes('project deploy start')) {
          if (!commandStr.includes('-l') && !commandStr.includes('--test-level') && !commandStr.includes('runlocaltests') && !commandStr.includes('runspecifiedtests')) {
            issues.push({
              type: 'SALESFORCE_MISSING_TEST_LEVEL',
              severity: 'HIGH',
              message: 'Salesforce deployment detected without a specified test level. Always use `-l RunLocalTests` or `-l RunSpecifiedTests` to prevent production code coverage failures.',
              fix: 'Add `--test-level RunLocalTests` to your deployment command.',
              line: step.line
            });
          }
        }

        // 2. Detect hardcoded Salesforce login credentials
        if (commandStr.includes('force:auth:jwt:grant') || commandStr.includes('org login jwt')) {
          if (commandStr.includes('--clientid') && !commandStr.includes('${{') && !commandStr.includes('$')) {
             // If client id is hardcoded rather than an environment variable
             const parts = commandStr.split('--clientid');
             if (parts.length > 1 && parts[1].trim().length > 15) {
               issues.push({
                type: 'SALESFORCE_HARDCODED_CLIENT_ID',
                severity: 'CRITICAL',
                message: 'Hardcoded Salesforce Connected App Client ID detected in authentication command.',
                fix: 'Store the Client ID in a secure environment variable (e.g., secrets.SF_CLIENT_ID) and reference it dynamically.',
                line: step.line
              });
             }
          }
        }

        // 3. Detect unvalidated destructive changes
        if (commandStr.includes('destructivechanges') || commandStr.includes('--ignorewarnings')) {
            issues.push({
              type: 'SALESFORCE_DESTRUCTIVE_CHANGES',
              severity: 'MEDIUM',
              message: 'Destructive changes or ignored warnings detected in Salesforce deployment.',
              fix: 'Ensure destructive deployments are restricted to specific branches or require manual approval in the CI/CD pipeline.',
              line: step.line
            });
        }
      }
    }

    return issues;
  }
}
