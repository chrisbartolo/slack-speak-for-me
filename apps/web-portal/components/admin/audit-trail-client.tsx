'use client';

import { useRouter } from 'next/navigation';
import { AuditTrailTable } from './audit-trail-table';

interface AuditTrailEntry {
  id: string;
  userId: string;
  userEmail?: string | null;
  action: string;
  channelId?: string | null;
  originalText?: string | null;
  finalText?: string | null;
  triggerContext?: string | null;
  createdAt: Date;
}

interface AuditTrailClientProps {
  data: AuditTrailEntry[];
  showText: boolean;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchParams: Record<string, string | undefined>;
}

export function AuditTrailClient({
  data,
  showText,
  total,
  page,
  pageSize,
  hasMore,
  searchParams,
}: AuditTrailClientProps) {
  const router = useRouter();

  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();

    // Merge existing params with updates
    const merged = { ...searchParams, ...updates };

    Object.entries(merged).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return `/admin/audit-trail?${params.toString()}`;
  };

  return (
    <AuditTrailTable
      data={data}
      showText={showText}
      total={total}
      page={page}
      pageSize={pageSize}
      hasMore={hasMore}
      onPageChange={(newPage) => {
        router.push(buildUrl({ page: newPage.toString() }));
      }}
      onPageSizeChange={(newPageSize) => {
        router.push(buildUrl({ pageSize: newPageSize.toString(), page: '1' }));
      }}
      onFilterChange={(filters) => {
        router.push(buildUrl({
          action: filters.action,
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: '1',
        }));
      }}
    />
  );
}
