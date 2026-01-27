'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { UserSearch } from './user-search';
import { personContextSchema, type PersonContextInput } from '@/lib/validations/person-context';
import { savePersonContext } from '@/app/(dashboard)/people/actions';

interface PersonContextFormProps {
  defaultValues?: {
    targetSlackUserId: string;
    contextText: string;
  };
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function PersonContextForm({ defaultValues, trigger, onSuccess }: PersonContextFormProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);

  const form = useForm<PersonContextInput>({
    resolver: zodResolver(personContextSchema),
    defaultValues: defaultValues ?? {
      targetSlackUserId: '',
      contextText: '',
    },
  });

  async function onSubmit(data: PersonContextInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('targetSlackUserId', data.targetSlackUserId);
      formData.set('contextText', data.contextText);
      if (selectedUserName) {
        formData.set('targetUserName', selectedUserName);
      }

      const result = await savePersonContext(formData);

      if (result.success) {
        toast.success(defaultValues ? 'Context updated' : 'Context added', {
          description: 'The person context has been saved.',
        });
        setOpen(false);
        form.reset();
        onSuccess?.();
      } else if (result.errors) {
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof PersonContextInput, {
            message: messages?.[0],
          });
        });
      } else if (result.error) {
        toast.error('Error', {
          description: result.error,
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Person
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{defaultValues ? 'Edit Context' : 'Add Person Context'}</DialogTitle>
          <DialogDescription>
            Add notes about this person to help AI generate better suggestions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="targetSlackUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Person</FormLabel>
                  <FormControl>
                    <UserSearch
                      value={field.value}
                      onChange={(userId, user) => {
                        field.onChange(userId);
                        setSelectedUserName(user?.displayName || user?.name || null);
                      }}
                      disabled={!!defaultValues}
                      placeholder="Search by name..."
                    />
                  </FormControl>
                  <FormDescription>
                    Search and select the person you want to add context about
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contextText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Context</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 'CMO, tends to bypass processes. CEO has asked me to push back diplomatically when they try to skip the roadmap.'"
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value.length}/1000 characters. Include relationship context, communication preferences, or background info.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Context'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
