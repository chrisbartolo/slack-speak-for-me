'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupStep {
  title: string;
  description: string;
  details: React.ReactNode;
  externalLink?: {
    label: string;
    url: string;
  };
}

const setupSteps: SetupStep[] = [
  {
    title: 'Create Google Cloud Project',
    description: 'Set up a Google Cloud project to enable API access',
    details: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Go to the Google Cloud Console</li>
        <li>Click &quot;Select a project&quot; at the top, then &quot;New Project&quot;</li>
        <li>Name your project (e.g., &quot;Slack Speak for Me&quot;)</li>
        <li>Click &quot;Create&quot; and wait for the project to be created</li>
        <li>Make sure your new project is selected in the project dropdown</li>
      </ol>
    ),
    externalLink: {
      label: 'Open Google Cloud Console',
      url: 'https://console.cloud.google.com/',
    },
  },
  {
    title: 'Enable Google Sheets API',
    description: 'Allow your project to access Google Sheets',
    details: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>In the Cloud Console, go to &quot;APIs &amp; Services&quot; → &quot;Library&quot;</li>
        <li>Search for &quot;Google Sheets API&quot;</li>
        <li>Click on &quot;Google Sheets API&quot; in the results</li>
        <li>Click the &quot;Enable&quot; button</li>
        <li>Wait for the API to be enabled (you&apos;ll see a green checkmark)</li>
      </ol>
    ),
    externalLink: {
      label: 'Go to API Library',
      url: 'https://console.cloud.google.com/apis/library',
    },
  },
  {
    title: 'Configure OAuth Consent Screen',
    description: 'Set up the authorization screen users will see',
    details: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Go to &quot;APIs &amp; Services&quot; → &quot;OAuth consent screen&quot;</li>
        <li>Choose &quot;External&quot; user type (or &quot;Internal&quot; if using Google Workspace)</li>
        <li>Click &quot;Create&quot;</li>
        <li>Fill in the required fields:
          <ul className="list-disc list-inside ml-4 mt-1">
            <li>App name: &quot;Slack Speak for Me&quot;</li>
            <li>User support email: Your email</li>
            <li>Developer contact email: Your email</li>
          </ul>
        </li>
        <li>Click &quot;Save and Continue&quot;</li>
        <li>On the Scopes page, click &quot;Add or Remove Scopes&quot;</li>
        <li>Add: <code className="bg-muted px-1 rounded">https://www.googleapis.com/auth/spreadsheets</code></li>
        <li>Click &quot;Save and Continue&quot;</li>
        <li>Add your email as a test user (if in testing mode)</li>
        <li>Click &quot;Save and Continue&quot;</li>
      </ol>
    ),
    externalLink: {
      label: 'Configure Consent Screen',
      url: 'https://console.cloud.google.com/apis/credentials/consent',
    },
  },
  {
    title: 'Create OAuth 2.0 Client ID',
    description: 'Generate credentials for the application',
    details: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Go to &quot;APIs &amp; Services&quot; → &quot;Credentials&quot;</li>
        <li>Click &quot;Create Credentials&quot; → &quot;OAuth 2.0 Client ID&quot;</li>
        <li>Application type: Select &quot;Web application&quot;</li>
        <li>Name: &quot;Slack Speak for Me Web Client&quot;</li>
        <li>Under &quot;Authorized redirect URIs&quot;, add:
          <ul className="list-disc list-inside ml-4 mt-1">
            <li><code className="bg-muted px-1 rounded text-xs">http://localhost:3000/oauth/google/callback</code> (for development)</li>
            <li>Your production URL with <code className="bg-muted px-1 rounded text-xs">/oauth/google/callback</code> (for production)</li>
          </ul>
        </li>
        <li>Click &quot;Create&quot;</li>
        <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
        <li>Add them to your server&apos;s environment variables:
          <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret`}
          </pre>
        </li>
        <li>Restart your server for the changes to take effect</li>
      </ol>
    ),
    externalLink: {
      label: 'Create Credentials',
      url: 'https://console.cloud.google.com/apis/credentials',
    },
  },
  {
    title: 'Create a Google Sheet',
    description: 'Set up the spreadsheet for report data',
    details: (
      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
        <li>Go to Google Sheets and create a new spreadsheet</li>
        <li>Name it something like &quot;Weekly Team Reports&quot;</li>
        <li>Copy the spreadsheet ID from the URL:
          <pre className="bg-muted p-2 rounded mt-1 text-xs overflow-x-auto">
            https://docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
          </pre>
        </li>
        <li>You&apos;ll enter this ID after connecting your Google account above</li>
      </ol>
    ),
    externalLink: {
      label: 'Create New Sheet',
      url: 'https://sheets.new',
    },
  },
];

interface GoogleSetupGuideProps {
  isConnected: boolean;
  hasSpreadsheet: boolean;
}

export function GoogleSetupGuide({ isConnected, hasSpreadsheet }: GoogleSetupGuideProps) {
  const [openSteps, setOpenSteps] = useState<number[]>([]);

  const toggleStep = (index: number) => {
    setOpenSteps((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  // Don't show if fully configured
  if (isConnected && hasSpreadsheet) {
    return null;
  }

  // Determine which steps are complete
  const getStepStatus = (index: number): 'complete' | 'current' | 'upcoming' => {
    // Steps 0-3 are about Google OAuth setup
    // Step 4 is about creating the spreadsheet
    if (isConnected) {
      // OAuth is done, only spreadsheet step might be pending
      if (index <= 3) return 'complete';
      if (index === 4 && !hasSpreadsheet) return 'current';
      return 'complete';
    }
    // Not connected yet - first 4 steps are current/upcoming
    if (index === 0) return 'current';
    return 'upcoming';
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google Sheets Setup Guide
        </CardTitle>
        <CardDescription>
          Follow these steps to connect Google Sheets for weekly report tracking.
          {isConnected && !hasSpreadsheet && (
            <span className="block mt-1 text-green-600 font-medium">
              Google account connected! Now configure your spreadsheet below.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {setupSteps.map((step, index) => {
          const status = getStepStatus(index);
          const isOpen = openSteps.includes(index);

          return (
            <Collapsible
              key={index}
              open={isOpen}
              onOpenChange={() => toggleStep(index)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-3 w-full p-3 rounded-lg text-left transition-colors',
                    status === 'complete' && 'bg-green-50 hover:bg-green-100',
                    status === 'current' && 'bg-white hover:bg-gray-50 border border-blue-200',
                    status === 'upcoming' && 'bg-gray-50 hover:bg-gray-100'
                  )}
                >
                  <div className="flex-shrink-0">
                    {status === 'complete' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className={cn(
                        'h-5 w-5',
                        status === 'current' ? 'text-blue-600' : 'text-gray-400'
                      )} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'font-medium',
                      status === 'complete' && 'text-green-800',
                      status === 'current' && 'text-gray-900',
                      status === 'upcoming' && 'text-gray-600'
                    )}>
                      Step {index + 1}: {step.title}
                    </div>
                    <div className={cn(
                      'text-sm',
                      status === 'complete' && 'text-green-600',
                      status === 'current' && 'text-gray-600',
                      status === 'upcoming' && 'text-gray-500'
                    )}>
                      {step.description}
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    'h-5 w-5 text-gray-400 transition-transform',
                    isOpen && 'transform rotate-180'
                  )} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-11 pr-3 pb-3">
                <div className="pt-3 space-y-3">
                  {step.details}
                  {step.externalLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="mt-3"
                    >
                      <a
                        href={step.externalLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                      >
                        {step.externalLink.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
