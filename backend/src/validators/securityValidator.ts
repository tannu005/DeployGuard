import { Pipeline, SecurityIssue } from '../types/pipeline';

export class SecurityValidator {
  private secretPatterns = [
    /password\s*[:=]\s*['"]?[a-zA-Z0-9_]+['"]?/i,
    /api[_-]?key\s*[:=]/i,
    /aws[_-]?secret/i,
    /gh[_-]?token/i,
    /github[_-]?token/i,
    /token\s*[:=]\s*['"]?[a-zA-Z0-9_]{10,}['"]?/i
  ];

  validate(pipeline: Pipeline): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = pipeline.rawYaml.split('\n');

    lines.forEach((line, index) => {
      this.secretPatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('${{')) {
          issues.push({
            type: 'HARDCODED_SECRET',
            severity: 'CRITICAL',
            message: 'Hardcoded secrets detected in pipeline configuration.',
            fix: 'Use GitHub Secrets or a vault system (e.g., ${{ secrets.MY_SECRET }}).',
            line: index + 1
          });
        }
      });
    });

    return issues;
  }
}
