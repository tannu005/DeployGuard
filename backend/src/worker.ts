import { Worker } from 'bullmq';
import { GitHubActionsParser } from './parsers/githubActions';
import { SecurityValidator } from './validators/securityValidator';
import { PerformanceValidator } from './validators/performanceValidator';
import { CostValidator } from './validators/costValidator';
import { SalesforceValidator } from './validators/salesforceValidator';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const redisOptions = {
  host: process.env.REDIS_HOST || 'redis',
  port: 6379
};

console.log('Starting DeployGuard Background Worker...');

const worker = new Worker('pipeline-analysis-queue', async job => {
  console.log(`Processing Job ${job.id} for workflow: ${job.data.filename}`);
  
  const yaml = job.data.yaml;
  const parser = new GitHubActionsParser();
  
  try {
    const pipeline = parser.parse(yaml);

    const securityValidator = new SecurityValidator();
    const performanceValidator = new PerformanceValidator();
    const costValidator = new CostValidator();
    const salesforceValidator = new SalesforceValidator();

    const securityIssues = securityValidator.validate(pipeline);
    const performanceIssues = performanceValidator.validate(pipeline);
    const costIssues = costValidator.validate(pipeline);
    const salesforceIssues = salesforceValidator.validate(pipeline);

    const allIssues = [...securityIssues, ...performanceIssues, ...costIssues, ...salesforceIssues];
    const critical = allIssues.filter(i => i.severity === 'CRITICAL').length;
    const timeSavings = performanceIssues.length * 45; 
    const costSavings = costIssues.length * 2.5;

    // Simulate DB persistence (In Enterprise this saves to Postgres with Team boundaries)
    /*
    await prisma.pipelineAnalysis.create({
      data: {
        workflowFile: job.data.filename || 'unknown.yml',
        totalIssues: allIssues.length,
        criticalIssues: critical,
        estimatedTimeSavingsS: timeSavings,
        estimatedCostSavingsPercent: costSavings,
      }
    });
    */

    console.log(`Finished processing Job ${job.id}`);
    
    // Return the actual validation issues so the WebSocket can broadcast them
    return {
      pipelineId: job.id,
      totalIssues: allIssues.length,
      criticalIssues: critical,
      timeSavings: `${timeSavings}s`,
      costSavings: `${costSavings}%`,
      issues: allIssues
    };
    
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    throw error;
  }
}, { connection: redisOptions });

worker.on('completed', job => {
  console.log(`Job with id ${job.id} has been completed`);
});

worker.on('failed', (job, err) => {
  console.log(`Job with id ${job?.id} has failed with ${err.message}`);
});
