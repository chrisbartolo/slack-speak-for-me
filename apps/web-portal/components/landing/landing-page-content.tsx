'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrushUnderline, BrushUnderlineThick } from '@/components/ui/brush-underline';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { faqItems } from '@/lib/seo/schemas';
import { Footer } from '@/components/footer';
import { SiteNav } from '@/components/site-nav';

function ErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  if (!error) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">
          {error === 'install_failed'
            ? 'Installation failed. Please try again or contact support.'
            : 'An error occurred. Please try again.'}
        </p>
      </div>
    </div>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-16">
        <h2 className="text-3xl font-bold text-gray-900 inline-block">
          Frequently Asked Questions
          <BrushUnderline className="w-full mt-1 opacity-50" />
        </h2>
        <p className="mt-4 text-gray-600">Everything you need to know about Speak for Me</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {faqItems.map((item, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white"
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{item.question}</span>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {openIndex === index && (
              <div className="px-6 pb-4">
                <p className="text-gray-600">{item.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}


function EmailSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong.');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-xl mx-auto text-center">
          <div className="bg-white rounded-2xl border border-gray-200/50 shadow-sm p-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">You're on the list!</h3>
            <p className="text-gray-600">We'll send you updates on new features and launch announcements.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Not ready to install yet?
        </h2>
        <p className="text-gray-600 mb-6">
          Get notified about new features, tips for handling difficult messages, and launch updates.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-md mx-auto">
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
            disabled={status === 'loading'}
          />
          <Button
            type="submit"
            disabled={status === 'loading'}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-sm whitespace-nowrap"
          >
            {status === 'loading' ? 'Subscribing...' : 'Stay Updated'}
          </Button>
        </form>
        {status === 'error' && (
          <p className="text-red-600 text-sm mt-2">{errorMsg}</p>
        )}
        <p className="text-xs text-gray-400 mt-3">No spam. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}

export function LandingPageContent() {
  const slackInstallUrl = process.env.NEXT_PUBLIC_SLACK_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_SLACK_BACKEND_URL}/slack/install`
    : '/slack/install';

  return (
    <div className="bg-[#FFFDF7]">
      {/* Navigation */}
      <SiteNav />

      {/* Error Message */}
      <Suspense fallback={null}>
        <ErrorBanner />
      </Suspense>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Craft Perfect Slack Responses with{' '}
              <span className="inline-block">
                <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">AI</span>
                <BrushUnderlineThick className="w-full mt-1 opacity-50" />
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Get contextually-aware response suggestions for challenging workplace messages.
              Speak for Me uses Claude AI to help you communicate professionally and effectively.
            </p>
            <p className="mt-3 text-sm text-gray-500 italic">
              AI-generated suggestions may not always be accurate. Always review before sending.
            </p>
            <div className="mt-10 flex items-center gap-x-6">
              <a href={slackInstallUrl}>
                <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-lg px-8 py-6 shadow-lg shadow-indigo-500/25">
                  <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Add to Slack - Free
                </Button>
              </a>
            </div>
          </div>
          <div className="relative">
            <Image
              src="/images/slack-mockup.png"
              alt="AI-powered response suggestions in Slack"
              width={600}
              height={400}
              className="rounded-2xl shadow-2xl"
              priority
            />
          </div>
        </div>
      </section>

      {/* Transform Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            <Image
              src="/images/feature-transform.png"
              alt="Transform difficult messages into professional responses"
              width={1200}
              height={400}
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 to-transparent flex items-center">
              <div className="px-8 md:px-12 max-w-lg">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  From frustration to finesse
                </h2>
                <p className="text-gray-200">
                  Transform difficult messages into polished, professional responses that get results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 inline-block">
            How It Works
            <BrushUnderline className="w-full mt-1 opacity-50" />
          </h2>
          <p className="mt-4 text-gray-600">Three simple ways to get AI-powered response suggestions</p>
        </div>

        <div className="mb-12">
          <Image
            src="/images/slack-marketplace-features.png"
            alt="Three steps: Watch conversations, get AI suggestions, review and send"
            width={1200}
            height={400}
            className="rounded-2xl shadow-lg w-full"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">@</span>
              </div>
              <CardTitle>Mention the Bot</CardTitle>
              <CardDescription>
                @mention Speak for Me in any channel to get a response suggestion for a difficult message.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">👀</span>
              </div>
              <CardTitle>Watch Conversations</CardTitle>
              <CardDescription>
                Use /speakforme-watch to monitor channels. Get notified with suggestions when someone replies.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <CardTitle>Message Shortcut</CardTitle>
              <CardDescription>
                Right-click any message and select "Help me respond" for instant AI assistance.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 inline-block">
              Why Speak for Me?
              <BrushUnderline className="w-full mt-1 opacity-50" />
            </h2>
          </div>

          <div className="mb-12">
            <Image
              src="/images/slack-marketplace-before-after.png"
              alt="Before and after: from stressing over messages to responding with confidence"
              width={1200}
              height={500}
              className="rounded-2xl shadow-lg w-full"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Private & Ephemeral</h3>
                  <p className="text-gray-600">Suggestions are only visible to you - no one else sees the AI assistance.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Context-Aware</h3>
                  <p className="text-gray-600">Understands the conversation context to provide relevant suggestions.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Refine & Customize</h3>
                  <p className="text-gray-600">Don't like the suggestion? Refine it with your specific instructions.</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Style Preferences</h3>
                  <p className="text-gray-600">Set your communication style and the AI adapts to match your voice.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Weekly Reports</h3>
                  <p className="text-gray-600">Automatically generate weekly standup reports from your Slack activity.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Secure & Private</h3>
                  <p className="text-gray-600">Enterprise-grade encryption. Your data stays private.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection />

      {/* Email Signup */}
      <EmailSignup />

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-6 inline-block">
          Ready to communicate better?
          <BrushUnderline className="w-full mt-1 opacity-50" />
        </h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Join teams who use Speak for Me to handle difficult workplace conversations with confidence.
        </p>
        <a href={slackInstallUrl}>
          <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-indigo-500/25">
            Add to Slack - It's Free
          </Button>
        </a>
      </section>

      {/* Footer with legal links */}
      <Footer />
    </div>
  );
}
