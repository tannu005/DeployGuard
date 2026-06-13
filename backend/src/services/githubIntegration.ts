import axios from 'axios';
import { GitHubActionsParser } from '../parsers/githubActions';
import { SecurityValidator } from '../validators/securityValidator';
import { PerformanceValidator } from '../validators/performanceValidator';
import { CostValidator } from '../validators/costValidator';
import { SalesforceValidator } from '../validators/salesforceValidator';

export class GitHubIntegrationService {
  /**
   * Fetches repositories for the authenticated user
   */
  async fetchUserRepos(accessToken: string) {
    try {
      const response = await axios.get('https://api.github.com/user/repos?per_page=100', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching GitHub repos:', error);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  /**
   * Fetches the contents of the .github/workflows directory
   */
  async fetchWorkflows(owner: string, repo: string, accessToken: string) {
    try {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      
      const workflows = [];
      if (Array.isArray(response.data)) {
        for (const file of response.data) {
          if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
            const fileContent = await axios.get(file.download_url);
            workflows.push({
              name: file.name,
              content: fileContent.data
            });
          }
        }
      }
      return workflows;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return []; // No workflows directory
      }
      console.error(`Error fetching workflows for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Automatically scans all workflows in a specific repository
   */
  async scanRepository(owner: string, repo: string, accessToken: string) {
    const workflows = await this.fetchWorkflows(owner, repo, accessToken);
    const results = [];

    const parser = new GitHubActionsParser();
    const securityValidator = new SecurityValidator();
    const performanceValidator = new PerformanceValidator();
    const costValidator = new CostValidator();
    const salesforceValidator = new SalesforceValidator();

    for (const workflow of workflows) {
      try {
        const pipeline = parser.parse(workflow.content);
        
        const securityIssues = securityValidator.validate(pipeline);
        const performanceIssues = performanceValidator.validate(pipeline);
        const costIssues = costValidator.validate(pipeline);
        const salesforceIssues = salesforceValidator.validate(pipeline);

        const allIssues = [...securityIssues, ...performanceIssues, ...costIssues, ...salesforceIssues];

        if (allIssues.length > 0) {
          results.push({
            workflowFile: workflow.name,
            totalIssues: allIssues.length,
            criticalIssues: allIssues.filter(i => i.severity === 'CRITICAL').length,
            issues: allIssues
          });
        }
      } catch (e) {
        console.warn(`Failed to parse workflow ${workflow.name} in ${repo}`);
      }
    }

    return results;
  }
}
