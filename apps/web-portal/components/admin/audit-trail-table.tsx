'use client';

import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

interface AuditTrailTableProps {
  data: AuditTrailEntry[];
  showText: boolean;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onFilterChange: (filters: { action?: string; startDate?: string; endDate?: string }) => void;
}

function getActionBadge(action: string) {
  const variants: Record<string, { color: string; label: string }> = {
    accepted: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Accepted' },
    refined: { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Refined' },
    dismissed: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Dismissed' },
    sent: { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Sent' },
  };

  const variant = variants[action] || { color: 'bg-gray-100 text-gray-800 border-gray-300', label: action };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variant.color}`}>
      {variant.label}
    </span>
  );
}

export function AuditTrailTable({
  data,
  showText,
  total,
  page,
  pageSize,
  hasMore,
  onPageChange,
  onPageSizeChange,
  onFilterChange,
}: AuditTrailTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const columns: ColumnDef<AuditTrailEntry>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Date/Time',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'));
        return (
          <div className="text-sm">
            <div className="font-medium">{format(date, 'MMM d, yyyy')}</div>
            <div className="text-muted-foreground">{format(date, 'HH:mm:ss')}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'userEmail',
      header: 'User',
      cell: ({ row }) => {
        const email = row.getValue('userEmail') as string | null;
        const userId = row.original.userId;
        return <div className="text-sm">{email || userId}</div>;
      },
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => {
        const action = row.getValue('action') as string;
        return getActionBadge(action);
      },
    },
    {
      accessorKey: 'channelId',
      header: 'Channel',
      cell: ({ row }) => {
        const channelId = row.getValue('channelId') as string | null;
        return <div className="text-sm font-mono text-muted-foreground">{channelId || 'N/A'}</div>;
      },
    },
  ];

  // Conditionally add text columns if showText is true
  if (showText) {
    columns.push(
      {
        accessorKey: 'originalText',
        header: 'Suggestion Text',
        cell: ({ row }) => {
          const text = row.getValue('originalText') as string | null;
          return (
            <div className="text-sm max-w-xs truncate" title={text || undefined}>
              {text || '-'}
            </div>
          );
        },
      },
      {
        accessorKey: 'finalText',
        header: 'Final Text',
        cell: ({ row }) => {
          const text = row.getValue('finalText') as string | null;
          return (
            <div className="text-sm max-w-xs truncate" title={text || undefined}>
              {text || '-'}
            </div>
          );
        },
      }
    );
  }

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  const handleApplyFilters = () => {
    onFilterChange({
      action: actionFilter === 'all' ? undefined : actionFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  };

  const handleClearFilters = () => {
    setActionFilter('all');
    setStartDate('');
    setEndDate('');
    onFilterChange({});
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Action</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="refined">Refined</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleApplyFilters}>Apply</Button>
          <Button variant="outline" onClick={handleClearFilters}>
            Clear
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="text-muted-foreground">
                    No audit entries found for the selected filters
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
