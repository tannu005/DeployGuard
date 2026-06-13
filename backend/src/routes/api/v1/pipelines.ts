import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { broadcastAnalysisComplete, broadcastAnalysisFailed } from '../../../services/logStreamer';

const prisma = new PrismaClient();
import { GitHubActionsParser } from '../../../parsers/githubActions';
import { SecurityValidator } from '../../../validators/securityValidator';
import { PerformanceValidator } from '../../../validators/performanceValidator';
import { CostValidator } from '../../../validators/costValidator';
import { SalesforceValidator } from '../../../validators/salesforceValidator';

const router = Router();

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    let { yaml, githubRepo, email, githubToken, isPrivate, customRules } = req.body;

    if (!yaml && !githubRepo) {
      return res.status(400).json({ error: 'Either YAML content or a GitHub repository URL is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your email in the "Check Active Subscriptions" box on the Pricing page to claim your 5 free scans.' });
    }

    // Lookup plan
    let userPlan = 'FREE';
    const subscription = await prisma.subscription.findUnique({
      where: { email },
    });
    if (subscription && subscription.status === 'ACTIVE') {
      userPlan = subscription.plan;
    }

    // Free tier scan limit check (5 scans per calendar month)
    if (userPlan === 'FREE') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const scanCount = await prisma.pipelineAnalysis.count({
        where: {
          userEmail: email,
          createdAt: {
            gte: startOfMonth
          }
        }
      });

      if (scanCount >= 5) {
        return res.status(403).json({ 
          error: "🚫 Monthly Free Scan Limit Reached. Unlock unlimited scans, private repo integration, and AI-powered autofocus suggestions by upgrading to Pro.\nJoin hundreds of DevOps engineers deploying with absolute confidence today. Upgrade now on our Pricing page!"
        });
      }
    }

    if (isPrivate && userPlan === 'FREE') {
      return res.status(403).json({ error: 'Private repository scanning requires a PRO or ENTERPRISE subscription.' });
    }

    if (customRules && customRules.length > 0 && userPlan !== 'ENTERPRISE') {
      return res.status(403).json({ error: 'Custom security rules are only available on the Enterprise tier.' });
    }

    let filename = 'manual-upload.yml';

    if (githubRepo) {
      const repoPath = githubRepo.replace('https://github.com/', '').replace('http://github.com/', '').replace('https://www.github.com/', '').trim();
      
      if (isPrivate) {
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DeployGuard-Security-Engine'
        };
        if (githubToken) {
          headers['Authorization'] = `token ${githubToken}`;
        }

        try {
          const response = await fetch(`https://api.github.com/repos/${repoPath}/contents/.github/workflows/deploy.yml`, { headers });
          if (!response.ok) {
            const fallback = await fetch(`https://api.github.com/repos/${repoPath}/contents/.github/workflows/main.yml`, { headers });
            if (!fallback.ok) throw new Error('Could not find deploy.yml or main.yml in private repository');
            const data = await fallback.json() as any;
            yaml = Buffer.from(data.content, 'base64').toString('utf-8');
            filename = `${repoPath}/.github/workflows/main.yml`;
          } else {
            const data = await response.json() as any;
            yaml = Buffer.from(data.content, 'base64').toString('utf-8');
            filename = `${repoPath}/.github/workflows/deploy.yml`;
          }
        } catch (err: any) {
          return res.status(400).json({ error: `Failed to fetch YAML from private GitHub repository: ${err.message}. Check token & repository path.` });
        }
      } else {
        try {
          const response = await fetch(`https://raw.githubusercontent.com/${repoPath}/main/.github/workflows/deploy.yml`);
          if (!response.ok) {
             const fallback = await fetch(`https://raw.githubusercontent.com/${repoPath}/main/.github/workflows/main.yml`);
             if (!fallback.ok) throw new Error('Could not find deploy.yml or main.yml in the repository');
             yaml = await fallback.text();
             filename = `${repoPath}/.github/workflows/main.yml`;
          } else {
             yaml = await response.text();
             filename = `${repoPath}/.github/workflows/deploy.yml`;
          }
        } catch (err) {
          return res.status(400).json({ error: 'Failed to fetch YAML from the provided GitHub repository. Ensure it is public and has a .github/workflows/main.yml' });
        }
      }
    }

    const jobId = Math.random().toString(36).substring(7) + Date.now().toString(36);

    // Run the AST pipeline asynchronously so we don't block the HTTP response
    setTimeout(async () => {
      try {
        const parser = new GitHubActionsParser();
        const pipeline = parser.parse(yaml);

        const securityValidator = new SecurityValidator();
        const performanceValidator = new PerformanceValidator();
        const costValidator = new CostValidator();
        const salesforceValidator = new SalesforceValidator();

        const securityIssues = securityValidator.validate(pipeline);
        const performanceIssues = performanceValidator.validate(pipeline);
        const costIssues = costValidator.validate(pipeline);
        const salesforceIssues = salesforceValidator.validate(pipeline);

        // Evaluate custom rules if Enterprise
        const customIssues: any[] = [];
        if (customRules && Array.isArray(customRules) && userPlan === 'ENTERPRISE') {
          customRules.forEach((rule: any) => {
            if (rule.pattern && yaml.includes(rule.pattern)) {
              customIssues.push({
                ruleId: rule.ruleId || 'CUSTOM-COMPLIANCE',
                severity: rule.severity || 'HIGH',
                description: rule.description || `Custom rule match: found pattern "${rule.pattern}"`,
                suggestion: rule.suggestion || 'Modify code to satisfy enterprise compliance policies.',
                line: 1
              });
            }
          });
        }

        const allIssues = [...securityIssues, ...performanceIssues, ...costIssues, ...salesforceIssues, ...customIssues];
        const critical = allIssues.filter(i => i.severity === 'CRITICAL').length;
        const timeSavings = performanceIssues.length * 45; 
        const costSavings = costIssues.length * 2.5;

        const report = {
          pipelineId: jobId,
          totalIssues: allIssues.length,
          criticalIssues: critical,
          timeSavings: `${timeSavings}s`,
          costSavings: `${costSavings}%`,
          issues: allIssues
        };

        // Save to Database
        await prisma.pipelineAnalysis.create({
          data: {
            id: jobId,
            userEmail: email,
            workflowFile: filename,
            totalIssues: allIssues.length,
            criticalIssues: critical,
            estimatedTimeSavingsS: timeSavings,
            estimatedCostSavingsPercent: costSavings,
          }
        });

        // Broadcast to WebSocket clients
        broadcastAnalysisComplete(jobId, report);
      } catch (error: any) {
        console.error('Error in pipeline analysis:', error);
        broadcastAnalysisFailed(jobId, error.message || 'Unknown parsing error');
      }
    }, 4500); // 4.5s delay to let the mock loading logs play out for the demo!

    return res.status(202).json({ 
      message: 'Analysis started successfully',
      jobId: jobId,
      status: 'PROCESSING'
    });

  } catch (error) {
    console.error('Error parsing pipeline for analysis:', error);
    return res.status(500).json({ error: 'Failed to start pipeline analysis' });
  }
});

router.get('/debug-db', (req: Request, res: Response) => {
  const dbUrl = process.env.DATABASE_URL || '';
  return res.json({
    hasDbUrl: !!dbUrl,
    length: dbUrl.length,
    prefix: dbUrl ? dbUrl.split(':')[0] + '://' : 'none',
    startsWithPostgres: dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')
  });
});

export default router;
