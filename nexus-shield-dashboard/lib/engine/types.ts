export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'note';
export type Profile = 'TR' | 'GLOBAL' | 'US';
export type RuleAction = 'block' | 'warn' | 'off';

export type FindingCategory = 'secret' | 'pii';

export interface DetectionMatch {
  ruleId: string;
  type: string;
  line: number;
  column: number;
  preview: string;
  matched: string;
  confidence: Confidence;
  severity: Severity;
  category: FindingCategory;
  entropy?: number;
}

export interface DetectorContext {
  filename: string;
  profile: Profile;
  allowlistExact: Set<string>;
  allowlistPatterns: RegExp[];
  ignorePaths: string[];
}

export interface Detector {
  id: string;
  category: FindingCategory;
  /** Empty = active for all profiles */
  profiles: Profile[];
  detect(content: string, ctx: DetectorContext): DetectionMatch[];
}
