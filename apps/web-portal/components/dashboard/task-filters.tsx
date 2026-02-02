'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TaskFiltersProps {
  currentStatus?: string;
  currentType?: string;
}

export function TaskFilters({ currentStatus, currentType }: TaskFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/dashboard/tasks?${params.toString()}`);
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <Select
        value={currentStatus || 'all'}
        onValueChange={(value) => updateFilter('status', value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="dismissed">Dismissed</SelectItem>
          <SelectItem value="snoozed">Snoozed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={currentType || 'all'}
        onValueChange={(value) => updateFilter('type', value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="action_request">Requests</SelectItem>
          <SelectItem value="commitment">Commitments</SelectItem>
          <SelectItem value="deadline">Deadlines</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
