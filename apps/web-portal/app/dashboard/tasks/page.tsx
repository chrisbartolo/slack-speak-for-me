import { CheckSquare, AlertTriangle, Calendar, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskList } from '@/components/dashboard/task-list';
import { TaskFilters } from '@/components/dashboard/task-filters';
import { getActionableItems, getActionableStats } from '@/lib/db/queries';

function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'destructive' | 'warning' | 'success';
}) {
  const variantStyles = {
    default: 'bg-muted text-muted-foreground',
    destructive: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    success: 'bg-green-100 text-green-700',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const [tasks, stats] = await Promise.all([
    getActionableItems(params.status, params.type),
    getActionableStats(),
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Actionable items detected from your Slack conversations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={CheckSquare}
          variant="default"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={AlertTriangle}
          variant="destructive"
        />
        <StatCard
          label="Due Today"
          value={stats.dueToday}
          icon={Calendar}
          variant="warning"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={CheckCircle}
          variant="success"
        />
      </div>

      {/* Filters */}
      <TaskFilters
        currentStatus={params.status}
        currentType={params.type}
      />

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            {tasks.length === 0
              ? 'No tasks match your filters'
              : `${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Tasks are automatically detected from messages in your watched conversations.
                When someone asks you to do something or you make a commitment, it will appear here.
              </p>
            </div>
          ) : (
            <TaskList tasks={tasks} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
