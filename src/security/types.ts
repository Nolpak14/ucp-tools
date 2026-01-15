/**
 * Security Scanner Types
 * Types for UCP endpoint security posture scanning
 */

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type SecurityCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface SecurityCheck {
  id: string;
  name: string;
  description: string;
  status: SecurityCheckStatus;
  severity: SecuritySeverity;
  details?: string;
  recommendation?: string;
}

export interface SecurityScanResult {
  domain: string;
  endpoint: string;
  scanned_at: string;
  score: number;           // 0-100 security score
  grade: string;           // A, B, C, D, F
  checks: SecurityCheck[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

export interface SecurityScanOptions {
  timeoutMs?: number;
  skipTlsCheck?: boolean;
  includeHeaders?: boolean;
}

// Security check IDs
export const SecurityCheckIds = {
  HTTPS_REQUIRED: 'HTTPS_REQUIRED',
  TLS_VERSION: 'TLS_VERSION',
  CORS_CONFIG: 'CORS_CONFIG',
  RATE_LIMITING: 'RATE_LIMITING',
  SECURITY_HEADERS: 'SECURITY_HEADERS',
  CONTENT_TYPE: 'CONTENT_TYPE',
  ERROR_DISCLOSURE: 'ERROR_DISCLOSURE',
  PRIVATE_IP: 'PRIVATE_IP',
  RESPONSE_TIME: 'RESPONSE_TIME',
  CACHE_HEADERS: 'CACHE_HEADERS',
} as const;

export type SecurityCheckId = typeof SecurityCheckIds[keyof typeof SecurityCheckIds];
