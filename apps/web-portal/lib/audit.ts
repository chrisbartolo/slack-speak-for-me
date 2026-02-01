import 'server-only';
import { db } from '@/lib/db';
import { auditLogs, type AuditAction } from '@slack-speak/database';

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  workspaceId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Log an audit event to the database.
 *
 * This is a fire-and-forget operation - errors are logged but never thrown.
 * Audit logging should never break application flow.
 */
export function logAuditEvent(entry: AuditLogEntry): void {
  // Fire-and-forget: don't await, catch errors internally
  db.insert(auditLogs)
    .values({
      action: entry.action,
      userId: entry.userId,
      workspaceId: entry.workspaceId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details,
      previousValue: entry.previousValue as Record<string, unknown> | undefined,
      newValue: entry.newValue as Record<string, unknown> | undefined,
    })
    .execute()
    .catch((error) => {
      // Log error but never throw - audit failures should not break app
      console.error('Failed to write audit log:', error, entry);
    });
}

/**
 * Log a user login event
 */
export function auditLogin(
  userId: string,
  workspaceId: string,
  ipAddress?: string
): void {
  logAuditEvent({
    action: 'login',
    userId,
    workspaceId,
    ipAddress,
    resource: 'user',
    resourceId: userId,
  });
}

/**
 * Log a user logout event
 */
export function auditLogout(userId: string, workspaceId: string): void {
  logAuditEvent({
    action: 'logout',
    userId,
    workspaceId,
    resource: 'user',
    resourceId: userId,
  });
}

/**
 * Log a data export request
 */
export function auditDataExport(userId: string, workspaceId: string): void {
  logAuditEvent({
    action: 'data_export_requested',
    userId,
    workspaceId,
    resource: 'user',
    resourceId: userId,
    details: { requestedAt: new Date().toISOString() },
  });
}

/**
 * Log a data deletion request
 */
export function auditDataDeletion(userId: string, workspaceId: string): void {
  logAuditEvent({
    action: 'data_delete_requested',
    userId,
    workspaceId,
    resource: 'user',
    resourceId: userId,
    details: { requestedAt: new Date().toISOString() },
  });
}

/**
 * Log a settings change event
 */
export function auditSettingsChange(
  userId: string,
  workspaceId: string,
  setting: string,
  previousValue: unknown,
  newValue: unknown
): void {
  logAuditEvent({
    action: 'settings_changed',
    userId,
    workspaceId,
    resource: 'settings',
    resourceId: setting,
    previousValue,
    newValue,
  });
}

/**
 * Log an admin action event
 */
export function auditAdminAction(
  userId: string,
  workspaceId: string,
  actionDescription: string,
  details?: Record<string, unknown>
): void {
  logAuditEvent({
    action: 'admin_action',
    userId,
    workspaceId,
    resource: 'admin',
    details: {
      description: actionDescription,
      ...details,
    },
  });
}
