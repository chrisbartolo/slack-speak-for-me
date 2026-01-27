'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from './tag-input';
import { stylePreferencesSchema, StylePreferences } from '@/lib/validations/style';
import { updateStylePreferences } from '@/app/(dashboard)/style/actions';

interface StylePreferencesFormProps {
  defaultValues?: Partial<StylePreferences>;
}

export function StylePreferencesForm({ defaultValues }: StylePreferencesFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<StylePreferences>({
    resolver: zodResolver(stylePreferencesSchema),
    defaultValues: {
      tone: defaultValues?.tone ?? null,
      formality: defaultValues?.formality ?? null,
      preferredPhrases: defaultValues?.preferredPhrases ?? [],
      avoidPhrases: defaultValues?.avoidPhrases ?? [],
      customGuidance: defaultValues?.customGuidance ?? null,
    },
  });

  async function onSubmit(data: StylePreferences) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('tone', data.tone ?? '');
      formData.set('formality', data.formality ?? '');
      formData.set('preferredPhrases', JSON.stringify(data.preferredPhrases));
      formData.set('avoidPhrases', JSON.stringify(data.avoidPhrases));
      formData.set('customGuidance', data.customGuidance ?? '');

      const result = await updateStylePreferences(formData);

      if (result.success) {
        toast.success('Settings saved', {
          description: 'Your style preferences have been updated.',
        });
      } else if (result.errors) {
        toast.error('Error', {
          description: 'Please check the form for errors.',
        });
        // Set form errors
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof StylePreferences, {
            message: messages?.[0],
          });
        });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tone & Formality</CardTitle>
            <CardDescription>
              Set your default communication style for AI suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tone</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Professional">Professional</SelectItem>
                      <SelectItem value="Friendly">Friendly</SelectItem>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Empathetic">Empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The overall emotional quality of your messages
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="formality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formality</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select formality level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Casual">Casual</SelectItem>
                      <SelectItem value="Neutral">Neutral</SelectItem>
                      <SelectItem value="Formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How formal or casual your messages should be
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phrases</CardTitle>
            <CardDescription>
              Phrases you like to use or want to avoid
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="preferredPhrases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phrases to use</FormLabel>
                  <FormControl>
                    <TagInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="e.g., 'Thanks for reaching out'"
                      maxTags={20}
                      maxLength={100}
                    />
                  </FormControl>
                  <FormDescription>
                    Phrases AI should try to incorporate in suggestions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="avoidPhrases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phrases to avoid</FormLabel>
                  <FormControl>
                    <TagInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="e.g., 'No worries'"
                      maxTags={20}
                      maxLength={100}
                    />
                  </FormControl>
                  <FormDescription>
                    Phrases AI should never use in suggestions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custom Guidance</CardTitle>
            <CardDescription>
              Any additional instructions for the AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="customGuidance"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., 'Always acknowledge the other person's point before disagreeing'"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    {(field.value?.length ?? 0)}/500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
