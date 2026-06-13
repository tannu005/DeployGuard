import { Router, Request, Response } from 'express';
import { Queue } from 'bullmq';
import crypto from 'crypto';

const router = Router();
const analysisQueue = new Queue('pipeline-analysis-queue', { 
  connection: { host: process.env.REDIS_HOST || 'redis', port: 6379 }
});

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'dev_secret';

// Basic verification of GitHub Webhook Signature
function verifySignature(req: Request) {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

router.post('/github', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && !verifySignature(req)) {
    return res.status(401).send('Unauthorized');
  }

  const event = req.headers['x-github-event'];
  
  if (event === 'push') {
    const commits = req.body.commits || [];
    let workflowsChanged = false;

    for (const commit of commits) {
      const allFiles = [...commit.added, ...commit.modified];
      if (allFiles.some(f => f.startsWith('.github/workflows/'))) {
        workflowsChanged = true;
        break;
      }
    }

    if (workflowsChanged) {
      // In a real app, we would fetch the specific workflow files from the commit
      // and dump them into the queue. For demonstration, we just push a placeholder job.
      await analysisQueue.add('analyze-workflow', {
        filename: 'webhook-triggered-workflow.yml',
        yaml: 'name: Mock Webhook Run' 
      });
      console.log('GitHub Push Webhook received: Added analysis job to queue.');
    }
  }

  res.status(202).send('Accepted');
});

export default router;
