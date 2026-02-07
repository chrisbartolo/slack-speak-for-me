'use client';

import { useState, useEffect } from 'react';
import { X, Mail, CreditCard, Building2, CheckCircle2, ArrowRight, Rocket } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

interface AccountSetupProps {
  hasEmail: boolean;
  hasActiveSubscription: boolean;
  isAdmin: boolean;
  subscriptionSource: 'individual' | 'organization' | null;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  action: string;
  completed: boolean;
}

export function AccountSetup({
  hasEmail,
  hasActiveSubscription,
  isAdmin,
  subscriptionSource,
}: AccountSetupProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('account-setup-dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('account-setup-dismissed', 'true');
    setDismissed(true);
  };

  const steps: SetupStep[] = [
    {
      id: 'email',
      title: 'Confirm your email',
      description: 'Your email is used for billing, notifications, and account recovery',
      icon: Mail,
      href: '/dashboard/settings',
      action: 'Go to settings',
      completed: hasEmail,
    },
    {
      id: 'subscription',
      title: 'Set up your subscription',
      description: hasActiveSubscription
        ? 'Your subscription is active'
        : 'New workspaces start with a free trial. Choose a plan to continue after trial ends.',
      icon: CreditCard,
      href: isAdmin ? '/admin/billing' : '/dashboard/billing',
      action: 'View plans',
      completed: hasActiveSubscription,
    },
    ...(isAdmin
      ? [
          {
            id: 'team',
            title: 'Review team settings',
            description: 'Configure your organization settings, brand voice, and team preferences',
            icon: Building2,
            href: '/admin/settings',
            action: 'Org settings',
            completed: subscriptionSource === 'organization',
          },
        ]
      : []),
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;

  if (dismissed || allComplete) {
    return null;
  }

  return (
    <Card className="border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Set Up Your Account
            </CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to get started with Speak for Me
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
