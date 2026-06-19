export type CheckResult = {
  url: string;
  h1: string;
  status: 'success' | 'error';
  result: string;
  elapsed: string;
};

export type WorkItem = CheckResult & {
  checker: string;
  note: string;
  estimatedMinutes: string;
  actualSeconds: number;
  isTracking: boolean;
  trackingStartedAt: number | null;
  fixItems?: FixItem[]; 
};

export type FixItem = {
  id: string;
  location: string;
  issue: string;
  suggestion: string;
  completed: boolean;
};

export type ProjectHistory = {
  id: string;
  projectName: string;
  sheetUrl: string;
  items: WorkItem[];
  savedAt: string;
};

export type JobStatus = 'pending' | 'running' | 'completed' | 'cancelled';

export type Job = {
  id: string;
  status: JobStatus;
  sheetUrl: string;
  totalUrls: number;
  results: CheckResult[];
  createdAt: number;
};