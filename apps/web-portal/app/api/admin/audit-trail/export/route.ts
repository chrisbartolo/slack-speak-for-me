import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { getAuditTrail } from '@/lib/admin/audit-trail';
import { getPlanFeatures } from '@/lib/admin/plan-features';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const { workspaces, organizations } = schema;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const exportFormat = searchParams.get('format') || 'csv';
    const action = searchParams.get('action') as 'accepted' | 'refined' | 'dismissed' | 'sent' | null;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    // Get workspace to retrieve plan ID
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId))
      .limit(1);

    // Get organization plan ID for feature gating
    let planId: string | null = null;
    if (workspace?.organizationId && session.organizationId) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, session.organizationId))
        .limit(1);

      planId = org?.planId ?? null;
    }

    const planFeatures = getPlanFeatures(planId);

    // Validate export permissions
    if (exportFormat === 'csv' && !planFeatures.csvExportEnabled) {
      return NextResponse.json(
        { error: 'CSV export not available in your plan' },
        { status: 403 }
      );
    }

    if (exportFormat === 'pdf' && !planFeatures.pdfExportEnabled) {
      return NextResponse.json(
        { error: 'PDF export not available in your plan' },
        { status: 403 }
      );
    }

    // Fetch all data (no pagination for export)
    const result = await getAuditTrail(
      session.organizationId,
      session.workspaceId,
      planId,
      {
        page: 1,
        pageSize: 10000, // Large limit for export
        action: action ?? undefined,
        userId: userId ?? undefined,
        startDate,
        endDate,
      }
    );

    if (exportFormat === 'csv') {
      return exportAsCSV(result.items, planFeatures.auditTrailTextVisible);
    } else if (exportFormat === 'pdf') {
      return exportAsPDF(result.items, planFeatures.auditTrailTextVisible, startDate, endDate);
    }

    return NextResponse.json(
      { error: 'Invalid export format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting audit trail:', error);
    return NextResponse.json(
      { error: 'Failed to export audit trail' },
      { status: 500 }
    );
  }
}

function exportAsCSV(items: any[], includeText: boolean) {
  const columns = [
    'Date/Time',
    'User Email',
    'Action',
    'Channel ID',
  ];

  if (includeText) {
    columns.push('Suggestion Text', 'Final Text', 'Trigger Context');
  }

  const rows = items.map((item) => {
    const row: any = {
      'Date/Time': format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      'User Email': item.userEmail || item.userId,
      'Action': item.action,
      'Channel ID': item.channelId || 'N/A',
    };

    if (includeText) {
      row['Suggestion Text'] = item.originalText || '';
      row['Final Text'] = item.finalText || '';
      row['Trigger Context'] = item.triggerContext || '';
    }

    return row;
  });

  const csv = Papa.unparse({
    fields: columns,
    data: rows,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
    },
  });
}

function exportAsPDF(items: any[], includeText: boolean, startDate?: Date, endDate?: Date) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.text('Compliance Audit Trail Report', 14, 20);

  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 28);

  if (startDate || endDate) {
    const dateRange = `Date Range: ${startDate ? format(startDate, 'yyyy-MM-dd') : 'Any'} to ${endDate ? format(endDate, 'yyyy-MM-dd') : 'Any'}`;
    doc.text(dateRange, 14, 34);
  }

  // Table columns
  const columns = [
    { header: 'Date/Time', dataKey: 'dateTime' },
    { header: 'User', dataKey: 'user' },
    { header: 'Action', dataKey: 'action' },
    { header: 'Channel', dataKey: 'channel' },
  ];

  if (includeText) {
    columns.push(
      { header: 'Suggestion', dataKey: 'suggestion' },
      { header: 'Final Text', dataKey: 'final' }
    );
  }

  // Table rows
  const rows = items.map((item) => {
    const row: any = {
      dateTime: format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm'),
      user: item.userEmail || item.userId,
      action: item.action,
      channel: item.channelId || 'N/A',
    };

    if (includeText) {
      row.suggestion = item.originalText?.substring(0, 100) || '';
      row.final = item.finalText?.substring(0, 100) || '';
    }

    return row;
  });

  // Generate table
  autoTable(doc, {
    columns,
    body: rows,
    startY: startDate || endDate ? 40 : 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }, // Blue header
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  const pdfBuffer = doc.output('arraybuffer');

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="audit-trail-${format(new Date(), 'yyyy-MM-dd')}.pdf"`,
    },
  });
}
