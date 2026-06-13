import { WebSocket } from 'ws';

export interface LogLine {
  type: 'LOG_LINE';
  timestamp: string;
  content: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
}

const mockLogs = [
  { c: "Cloning repository...", s: "INFO" },
  { c: "Scanning workflow configuration...", s: "INFO" },
  { c: "Fetching Enterprise deployment profile", s: "INFO" },
  { c: "Validating against 40+ security rules...", s: "INFO" },
  { c: "✓ Connected to Salesforce Sandbox (user@org.com)", s: "SUCCESS" },
  { c: "Parsing package.xml for metadata dependencies...", s: "INFO" },
  { c: "Missing profile dependencies detected. Auto-correcting...", s: "WARN" },
  { c: "Starting Apex PMD Static Analysis", s: "INFO" },
  { c: "Scanned 42 Apex Classes in 8.4s", s: "SUCCESS" },
  { c: "Analyzing DML statements...", s: "INFO" },
  { c: "Warning: SOQL query found inside FOR loop at AccountTriggerHandler.cls:42", s: "WARN" },
  { c: "Verifying Destructive Changes (destructiveChanges.xml)", s: "INFO" },
  { c: "✓ No critical fields marked for deletion", s: "SUCCESS" },
  { c: "Scanning for hardcoded 15/18-character Record IDs...", s: "INFO" },
  { c: "Error: Hardcoded ID '00130000000abcD' found in TestDataFactory.cls", s: "ERROR" },
  { c: "Checking test coverage requirements (--test-level RunLocalTests)", s: "INFO" },
  { c: "Error: Test coverage is at 68% (75% required for Prod deployment)", s: "ERROR" },
  { c: "Pipeline analysis completed. Generating DeployGuard Report...", s: "INFO" },
];

// Remove BullMQ dependency
const activeConnections = new Map<string, WebSocket>();
const activeIntervals = new Map<string, NodeJS.Timeout>();

export function handleLogStream(ws: WebSocket, pipelineId: string) {
  let currentIndex = 0;
  let isFinished = false;

  activeConnections.set(pipelineId, ws);

  // Send initial connected message
  ws.send(JSON.stringify({
    type: 'LOG_LINE',
    timestamp: new Date().toISOString(),
    content: `Connected to log stream for pipeline ${pipelineId}...`,
    severity: 'INFO'
  }));

  // Simulate logs ticking while the real backend processes
  const interval = setInterval(() => {
    if (isFinished) {
      clearInterval(interval);
      return;
    }
    if (ws.readyState !== 1) { // 1 is WebSocket.OPEN
      isFinished = true;
      clearInterval(interval);
      return;
    }
    if (currentIndex < mockLogs.length) {
      const log = mockLogs[currentIndex];
      ws.send(JSON.stringify({
        type: 'LOG_LINE',
        timestamp: new Date().toISOString(),
        content: log.c,
        severity: log.s
      }));
      currentIndex++;
    }
  }, 800);

  activeIntervals.set(pipelineId, interval);

  ws.on('close', () => {
    isFinished = true;
    clearInterval(interval);
    activeConnections.delete(pipelineId);
    activeIntervals.delete(pipelineId);
  });
}

export function broadcastAnalysisComplete(pipelineId: string, report: any) {
  const ws = activeConnections.get(pipelineId);
  const interval = activeIntervals.get(pipelineId);
  
  if (interval) {
    clearInterval(interval);
    activeIntervals.delete(pipelineId);
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'LOG_LINE',
      timestamp: new Date().toISOString(),
      content: `Pipeline analysis completed. Generated true AST report.`,
      severity: 'INFO'
    }));

    ws.send(JSON.stringify({
      type: 'ANALYSIS_COMPLETE',
      report: report
    }));
  }
}

export function broadcastAnalysisFailed(pipelineId: string, failedReason: string) {
  const ws = activeConnections.get(pipelineId);
  const interval = activeIntervals.get(pipelineId);
  
  if (interval) {
    clearInterval(interval);
    activeIntervals.delete(pipelineId);
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'LOG_LINE',
      timestamp: new Date().toISOString(),
      content: `Analysis failed: ${failedReason}`,
      severity: 'ERROR'
    }));
  }
}
