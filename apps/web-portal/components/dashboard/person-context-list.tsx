'use client';

import { useState, useTransition } from 'react';
import { Edit2, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PersonContextForm } from '@/components/forms/person-context-form';
import { deletePersonContext } from '@/app/dashboard/people/actions';

interface PersonContext {
  id: string;
  targetSlackUserId: string;
  targetUserName: string | null;
  contextText: string;
  updatedAt: Date | null;
}

interface PersonContextListProps {
  contexts: PersonContext[];
}

export function PersonContextList({ contexts }: PersonContextListProps) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deletePersonContext(id);

      if (result.success) {
        toast.success('Context removed', {
          description: 'The person context has been deleted.',
        });
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to delete context',
        });
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="space-y-4">
      {contexts.map((context) => (
        <Card key={context.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {context.targetUserName || context.targetSlackUserId}
                    </p>
                    {context.updatedAt && (
                      <span className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(context.updatedAt, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {context.targetUserName && (
                    <p className="text-xs text-muted-foreground">{context.targetSlackUserId}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {context.contextText}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <PersonContextForm
                  defaultValues={{
                    targetSlackUserId: context.targetSlackUserId,
                    contextText: context.contextText,
                  }}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  }
                />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending && deletingId === context.id}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete context?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all context for this person. AI will no longer use this
                        information when generating suggestions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(context.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
