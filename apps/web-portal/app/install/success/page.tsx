'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InstallSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">💬</span>
              <span className="font-bold text-xl">Speak for Me</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Success Message */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Successfully Installed!
          </h1>
          <p className="text-gray-600">
            Speak for Me is now ready to use in your Slack workspace.
          </p>
        </div>

        {/* Getting Started Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Get Started in 3 Steps</CardTitle>
            <CardDescription>
              Follow these quick steps to start using AI-powered response suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center font-semibold text-purple-600">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Invite the bot to a channel</h3>
                <p className="text-gray-600 text-sm mt-1">
                  In Slack, go to a channel and type <code className="bg-gray-100 px-1 rounded">/invite @Speak for Me</code> or
                  mention <code className="bg-gray-100 px-1 rounded">@Speak for Me</code> to add it.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center font-semibold text-purple-600">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Try the message shortcut</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Right-click any message → More message shortcuts → "Help me respond" to get an AI suggestion.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center font-semibold text-purple-600">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Customize your style (optional)</h3>
                <p className="text-gray-600 text-sm mt-1">
                  Sign in to the web portal to set your communication preferences and the AI will adapt to your voice.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Tips */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>
                  <strong>Suggestions are private</strong> - Only you can see the AI suggestions (ephemeral messages).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>
                  <strong>Use /watch</strong> - Monitor a channel to automatically get suggestions when you're mentioned.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>
                  <strong>Refine suggestions</strong> - Click "Refine" to adjust the AI's response with specific instructions.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>
                  <strong>Copy or Send</strong> - Copy the suggestion to your clipboard or send directly from the bot.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="w-full sm:w-auto bg-[#4A154B] hover:bg-[#3d1140]">
              Sign In to Dashboard
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
            <a href="https://slack.com/app_redirect?app=YOUR_APP_ID" target="_blank" rel="noopener noreferrer">
              Open Slack
            </a>
          </Button>
        </div>

        {/* Help Link */}
        <p className="text-center text-sm text-gray-500 mt-8">
          Need help? Check our{' '}
          <Link href="/docs" className="text-purple-600 hover:underline">
            documentation
          </Link>{' '}
          or contact support.
        </p>
      </div>
    </div>
  );
}
