import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const totalAnalyses = await prisma.pipelineAnalysis.count();
    
    // Aggregations
    const aggregations = await prisma.pipelineAnalysis.aggregate({
      _sum: {
        criticalIssues: true,
      },
      _avg: {
        estimatedTimeSavingsS: true,
        estimatedCostSavingsPercent: true,
      }
    });

    const stats = {
      totalScans: totalAnalyses,
      totalCriticalIssues: aggregations._sum.criticalIssues || 0,
      avgTimeSavingsS: Math.round(aggregations._avg.estimatedTimeSavingsS || 0),
      avgCostSavingsPercent: Math.round((aggregations._avg.estimatedCostSavingsPercent || 0) * 10) / 10
    };

    // Trends from recent analyses
    const recent = await prisma.pipelineAnalysis.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    const trends = recent.map(r => ({
      date: new Date(r.createdAt).toLocaleDateString('en-US', { weekday: 'short' }),
      issues: r.totalIssues
    })).reverse();

    // Pad trends if we don't have enough data
    while (trends.length < 5) {
      trends.unshift({ date: '-', issues: 0 });
    }

    return res.status(200).json({
      stats,
      trends
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
