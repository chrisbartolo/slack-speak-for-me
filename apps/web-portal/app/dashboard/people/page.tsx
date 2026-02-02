import { Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PersonContextList } from '@/components/dashboard/person-context-list';
import { PersonContextForm } from '@/components/forms/person-context-form';
import { EmptyState } from '@/components/dashboard/empty-state';
import { getPersonContexts } from '@/lib/db/queries';

export default async function PeoplePage() {
  const contexts = await getPersonContexts();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">People</h1>
          <p className="text-muted-foreground mt-1">
            Add context about people to help AI generate better suggestions
          </p>
        </div>
        <PersonContextForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Person Contexts</CardTitle>
          <CardDescription>
            {contexts.length === 0
              ? 'No person contexts added yet'
              : `${contexts.length} ${contexts.length === 1 ? 'person' : 'people'} with context`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contexts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No person contexts"
              description="Add context about people you communicate with to help AI understand your relationships and generate more appropriate suggestions."
              action={<PersonContextForm />}
            />
          ) : (
            <PersonContextList contexts={contexts} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tips for good context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Include relationship context:</strong>{' '}
            &quot;My direct manager&quot;, &quot;Senior VP I report to quarterly&quot;, &quot;Cross-functional partner&quot;
          </p>
          <p>
            <strong className="text-foreground">Note communication preferences:</strong>{' '}
            &quot;Prefers bullet points&quot;, &quot;Appreciates detailed explanations&quot;, &quot;Values brevity&quot;
          </p>
          <p>
            <strong className="text-foreground">Add relevant background:</strong>{' '}
            &quot;Often pushes back on timelines&quot;, &quot;Champion of our project&quot;, &quot;New to the team&quot;
          </p>
          <p>
            <strong className="text-foreground">Share guidance you&apos;ve received:</strong>{' '}
            &quot;CEO asked me to push back diplomatically on scope creep requests&quot;
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
