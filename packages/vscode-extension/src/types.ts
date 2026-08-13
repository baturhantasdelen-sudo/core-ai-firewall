export type FindingCategory = 'secret' | 'pii';

export interface ScanMatch {
  ruleId: string;
  type: string;
  line: number;
  column: number;
  matched: string;
  category: FindingCategory;
  rangeStart: number;
  rangeEnd: number;
}

export type Profile = 'TR' | 'US' | 'GLOBAL';
