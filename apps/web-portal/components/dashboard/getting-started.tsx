'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Eye, Sliders, Users, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

interface GettingStartedProps {
  hasWatchedConversations: boolean;
  hasStylePreferences: boolean;
  hasPersonContext: boolean;
  hasFeedback: boolean;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  action: string;
  completed: boolean;
}

export function GettingStarted({
  hasWatchedConversations,
  hasStylePreferences,
  hasPersonContext,
  hasFeedback,
}: GettingStartedProps) {
  const [dismissed, setDismissed] = useState(false);

  // Check localStorage for dismissal
  useEffect(() => {
    const isDismissed = localStorage.getItem('getting-started-dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('getting-started-dismissed', 'true');
    setDismissed(true);
  };

  const steps: Step[] = [
    {
      id: 'watch',
      title: 'Watch a conversation',
      description: 'Use /watch in a Slack channel or DM to start receiving AI suggestions',
      icon: Eye,
      href: '/dashboard/conversations',
      action: 'View conversations',
      completed: hasWatchedConversations,
    },
    {
      id: 'style',
      title: 'Set your style preferences',
      description: 'Configure your tone, formality, and phrases to personalize suggestions',
      icon: Sliders,
      href: '/dashboard/style',
      action: 'Configure style',
      completed: hasStylePreferences,
    },
    {
      id: 'context',
      title: 'Add context about people',
      description: 'Help AI understand your relationships for better suggestions',
      icon: Users,
      href: '/dashboard/people',
      action: 'Add people',
      completed: hasPersonContext,
    },
    {
      id: 'feedback',
      title: 'Use and refine suggestions',
      description: 'Accept, refine, or dismiss suggestions to help AI learn your preferences',
      icon: MessageSquare,
      href: '/dashboard/feedback',
      action: 'View feedback',
      completed: hasFeedback,
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;

  // Don't show if dismissed or all complete
  if (dismissed || allComplete) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Get Started with Speak for Me
            </CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to get the most out of your AI assistant
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {completedCount} of {steps.length} completed
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                  step.completed
                    ? 'bg-green-50 dark:bg-green-950/30'
                    : 'bg-background hover:bg-muted/50'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    step.completed
                      ? 'bg-green-100 dark:bg-green-900'
                      : 'bg-muted'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      step.completed ? 'text-green-700 dark:text-green-300' : ''
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {step.description}
                  </p>
                </div>
                {!step.completed && (
                  <Link href={step.href}>
                    <Button size="sm" variant="outline" className="shrink-0">
                      {step.action}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
