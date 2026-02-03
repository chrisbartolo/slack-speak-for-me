/**
 * Plan-gated feature access for admin dashboard.
 * Controls what admin features are available per plan tier.
 * Aligns plan IDs with plans.config.ts (free, starter, pro, team, business).
 */

export interface PlanFeatures {
  // Audit trail
  auditTrailTextVisible: boolean;  // Can admin see actual suggestion text?
  dataRetentionDays: number;       // How long to keep audit data

  // Templates
  maxTemplates: number;            // Max shared templates allowed

  // Analytics
  analyticsHistoryMonths: number;  // How many months of analytics data
  csvExportEnabled: boolean;       // Can export to CSV
  pdfExportEnabled: boolean;       // Can export to PDF

  // Guardrails
  maxBlockedKeywords: number;      // Custom keyword limit
  aiCategoryDetection: boolean;    // AI-powered category detection (vs keyword only)
}

export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  free: {
    auditTrailTextVisible: false,
    dataRetentionDays: 7,
    maxTemplates: 0,
    analyticsHistoryMonths: 1,
    csvExportEnabled: false,
    pdfExportEnabled: false,
    maxBlockedKeywords: 0,
    aiCategoryDetection: false,
  },
  starter: {
    auditTrailTextVisible: false,
    dataRetentionDays: 30,
    maxTemplates: 5,
    analyticsHistoryMonths: 3,
    csvExportEnabled: true,
    pdfExportEnabled: false,
    maxBlockedKeywords: 10,
    aiCategoryDetection: false,
  },
  pro: {
    auditTrailTextVisible: false,
    dataRetentionDays: 90,
    maxTemplates: 25,
    analyticsHistoryMonths: 6,
    csvExportEnabled: true,
    pdfExportEnabled: false,
    maxBlockedKeywords: 50,
    aiCategoryDetection: true,
  },
  team: {
    auditTrailTextVisible: true,
    dataRetentionDays: 90,
    maxTemplates: 50,
    analyticsHistoryMonths: 6,
    csvExportEnabled: true,
    pdfExportEnabled: true,
    maxBlockedKeywords: 100,
    aiCategoryDetection: true,
  },
  business: {
    auditTrailTextVisible: true,
    dataRetentionDays: 90,
    maxTemplates: 100,
    analyticsHistoryMonths: 6,
    csvExportEnabled: true,
    pdfExportEnabled: true,
    maxBlockedKeywords: 500,
    aiCategoryDetection: true,
  },
};

export function getPlanFeatures(planId: string | null | undefined): PlanFeatures {
  return PLAN_FEATURES[planId || 'free'] || PLAN_FEATURES.free;
}
