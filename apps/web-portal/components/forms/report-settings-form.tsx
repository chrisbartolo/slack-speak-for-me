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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { reportSettingsSchema, ReportSettings } from '@/lib/validations/report-settings';
import { saveReportSettings, ActionResult } from '@/app/dashboard/reports/actions';

const daysOfWeek = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const sections = [
  { id: 'achievements', label: 'Achievements' },
  { id: 'focus', label: 'Current Focus' },
  { id: 'blockers', label: 'Blockers' },
  { id: 'shoutouts', label: 'Shoutouts' },
] as const;

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

interface ReportSettingsFormProps {
  defaultValues?: Partial<ReportSettings>;
  disabled?: boolean;
}

export function ReportSettingsForm({ defaultValues, disabled }: ReportSettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<ReportSettings>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(reportSettingsSchema as any),
    defaultValues: {
      enabled: defaultValues?.enabled ?? false,
      dayOfWeek: defaultValues?.dayOfWeek ?? 1,
      timeOfDay: defaultValues?.timeOfDay ?? '09:00',
      timezone: defaultValues?.timezone ?? 'America/New_York',
      format: defaultValues?.format ?? 'detailed',
      sections: defaultValues?.sections ?? ['achievements', 'focus', 'blockers', 'shoutouts'],
      autoSend: defaultValues?.autoSend ?? false,
    },
  });

  const enabled = form.watch('enabled');

  async function onSubmit(data: ReportSettings) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('enabled', String(data.enabled));
      formData.set('dayOfWeek', String(data.dayOfWeek));
      formData.set('timeOfDay', data.timeOfDay);
      formData.set('timezone', data.timezone);
      formData.set('format', data.format);
      formData.set('sections', JSON.stringify(data.sections));
      formData.set('autoSend', String(data.autoSend));

      const result = await saveReportSettings(formData);

      if (result.success) {
        toast.success('Settings saved', {
          description: 'Your report settings have been updated.',
        });
      } else if (result.errors) {
        toast.error('Error', {
          description: 'Please check the form for errors.',
        });
        Object.entries(result.errors).forEach(([field, messages]) => {
          form.setError(field as keyof ReportSettings, {
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <fieldset disabled={disabled} className={disabled ? 'opacity-60' : ''}>
        {disabled && (
          <p className="text-sm text-gray-500 mb-4">
            Configure Google Sheets above to enable report settings.
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Report Schedule</CardTitle>
            <CardDescription>
              Configure when weekly reports should be generated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable scheduled reports</FormLabel>
                    <FormDescription>
                      Automatically generate reports on schedule
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="dayOfWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v, 10))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {daysOfWeek.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeOfDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timezones.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Format</CardTitle>
            <CardDescription>
              Choose how your reports should be formatted
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Length</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="concise">Concise (bullet points)</SelectItem>
                      <SelectItem value="detailed">Detailed (full summaries)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sections"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel>Include sections</FormLabel>
                    <FormDescription>
                      Select which sections to include in reports
                    </FormDescription>
                  </div>
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <FormField
                        key={section.id}
                        control={form.control}
                        name="sections"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(section.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, section.id]);
                                  } else {
                                    field.onChange(current.filter((v) => v !== section.id));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{section.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
            <CardDescription>
              Control how reports are delivered to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="autoSend"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Auto-send reports</FormLabel>
                    <FormDescription>
                      When disabled, reports are sent as drafts for your review before sharing
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || disabled}>
            {isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
        </fieldset>
      </form>
    </Form>
  );
}
