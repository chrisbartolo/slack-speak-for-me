'use client';

import { useState, useTransition } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  Pin,
  Handshake,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { completeTask, dismissTask, snoozeTask } from '@/app/dashboard/tasks/actions';
import { toast } from 'sonner';
import type { ActionableItem } from '@slack-speak/database';

interface TaskListProps {
  tasks: ActionableItem[];
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'action_request':
      return Pin;
    case 'commitment':
      return Handshake;
    case 'deadline':
      return Clock;
    default:
      return Pin;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'action_request':
      return { label: 'Request', className: 'bg-blue-100 text-blue-700' };
    case 'commitment':
      return { label: 'Commitment', className: 'bg-purple-100 text-purple-700' };
    case 'deadline':
      return { label: 'Deadline', className: 'bg-amber-100 text-amber-700' };
    default:
      return { label: 'Task', className: 'bg-gray-100 text-gray-700' };
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' };
    case 'completed':
      return { label: 'Completed', className: 'bg-green-100 text-green-700' };
    case 'dismissed':
      return { label: 'Dismissed', className: 'bg-gray-100 text-gray-600' };
    case 'snoozed':
      return { label: 'Snoozed', className: 'bg-blue-100 text-blue-700' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-700' };
  }
}

export function TaskList({ tasks: initialTasks }: TaskListProps) {
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [taskToAction, setTaskToAction] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    setSelectedId(id);
    startTransition(async () => {
      const result = await completeTask(id);

      if (result.success) {
        toast.success('Task marked as complete');
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: 'completed', completedAt: new Date() } : t
          )
        );
      } else {
        toast.error('Failed to complete task', { description: result.error });
      }
      setSelectedId(null);
    });
  };

  const handleDismiss = async (id: string) => {
    setSelectedId(id);
    startTransition(async () => {
      const result = await dismissTask(id);

      if (result.success) {
        toast.success('Task dismissed');
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: 'dismissed', dismissedAt: new Date() } : t
          )
        );
      } else {
        toast.error('Failed to dismiss task', { description: result.error });
      }
      setSelectedId(null);
      setDismissDialogOpen(false);
      setTaskToAction(null);
    });
  };

  const handleSnooze = async (id: string, hours: number) => {
    setSelectedId(id);
    startTransition(async () => {
      const result = await snoozeTask(id, hours);

      if (result.success) {
        toast.success(`Task snoozed for ${hours === 24 ? '1 day' : hours === 168 ? '1 week' : `${hours} hours`}`);
        const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, status: 'snoozed', snoozedUntil } : t
          )
        );
      } else {
        toast.error('Failed to snooze task', { description: result.error });
      }
      setSelectedId(null);
    });
  };

  const openDismissDialog = (id: string) => {
    setTaskToAction(id);
    setDismissDialogOpen(true);
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {tasks.map((task) => {
          const TypeIcon = getTypeIcon(task.actionableType);
          const typeBadge = getTypeBadge(task.actionableType);
          const statusBadge = getStatusBadge(task.status || 'pending');
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status === 'pending';
          const isLoading = isPending && selectedId === task.id;

          return (
            <Card
              key={task.id}
              className={`transition-opacity ${isLoading ? 'opacity-50' : ''} ${
                isOverdue ? 'border-red-200 bg-red-50/30' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left side: icon + info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isOverdue ? 'bg-red-100' : 'bg-muted'
                      }`}
                    >
                      <TypeIcon
                        className={`h-5 w-5 ${isOverdue ? 'text-red-600' : ''}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium truncate">{task.title}</h3>
                        <Badge className={typeBadge.className} variant="secondary">
                          {typeBadge.label}
                        </Badge>
                        {task.status !== 'pending' && (
                          <Badge className={statusBadge.className} variant="secondary">
                            {statusBadge.label}
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {task.dueDate && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`flex items-center gap-1 ${
                                  isOverdue ? 'text-red-600 font-medium' : ''
                                }`}
                              >
                                <Calendar className="h-3 w-3" />
                                {format(new Date(task.dueDate), 'MMM d')}
                                {isOverdue && ' (overdue)'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatDistanceToNow(new Date(task.dueDate), {
                                addSuffix: true,
                              })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span>
                          Detected{' '}
                          {task.detectedAt &&
                            formatDistanceToNow(new Date(task.detectedAt), {
                              addSuffix: true,
                            })}
                        </span>
                        {task.confidenceScore && (
                          <span>{task.confidenceScore}% confidence</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'pending' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleComplete(task.id)}
                              disabled={isLoading}
                            >
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mark complete</TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isLoading}>
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSnooze(task.id, 24)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Snooze 1 day
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSnooze(task.id, 168)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Snooze 1 week
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => openDismissDialog(task.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Dismiss
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the task from your pending list. You can still see it in the
              completed/dismissed filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToAction && handleDismiss(taskToAction)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
