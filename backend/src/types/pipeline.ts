export interface PipelineJob {
  id: string;
  name?: string;
  runsOn?: string;
  steps: PipelineStep[];
  needs?: string[];
}

export interface PipelineStep {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
  line?: number;
}

export interface DockerImage {
  name: string;
  size?: number; // mock size in MB
}

export interface Pipeline {
  name?: string;
  provider: 'github' | 'gitlab' | 'jenkins';
  jobs: PipelineJob[];
  dockerImage?: DockerImage;
  rawYaml: string;
}

export interface SecurityIssue {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  fix: string;
  line?: number;
}

export interface PerformanceIssue {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  fix: string;
  line?: number;
}

export interface CostIssue {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  fix: string;
  line?: number;
}

export type PipelineIssue = SecurityIssue | PerformanceIssue | CostIssue;

export interface PipelineReport {
  totalIssues: number;
  critical: number;
  timeSavings: number; // in seconds
  costSavings: number; // percentage
  issues: PipelineIssue[];
}
