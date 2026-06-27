export type CheckResult = {
  url: string;
  h1: string;
  status: 'success' | 'error';
  result: string;
  elapsed: string;
  screenshotBase64?: string; // スクショ画像（Base64、JPEG）
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

export type FixStatus = 'pending' | 'completed' | 'not_needed';

export type FixItem = {
  id: string;
  location: string;
  issue: string;
  suggestion: string;
  status: FixStatus;
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

export type SavedProject = {
  id: string;
  projectName: string;
  sheetUrl: string;
  items: WorkItem[];
  savedAt: string;
  savedBy?: string;
};