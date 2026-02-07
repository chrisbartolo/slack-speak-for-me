'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrushUnderline, BrushUnderlineThick } from '@/components/ui/brush-underline';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { faqItems } from '@/lib/seo/schemas';
import { Footer } from '@/components/footer';
import { SiteNav } from '@/components/site-nav';
import {
  Users,
  Building2,
  Shield,
  TrendingUp,
  Brain,
  AlertTriangle,
  MessageSquare,
  Megaphone,
  Library,
  ScrollText,
  Heart,
  FileBox,
  BarChart3,
  Zap,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">You&apos;re on the list!</h3>
            <p className="text-gray-600">We&apos;ll send you updates on new features and launch announcements.</p>
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
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            AI-Powered Communication for{' '}
            <span className="inline-block">
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Slack Teams</span>
              <BrushUnderlineThick className="w-full mt-1 opacity-50" />
            </span>
          </h1>
          <p className="mt-6 text-xl leading-8 text-gray-600 max-w-3xl mx-auto">
            From personal response suggestions to enterprise-grade client communication management.
            Speak for Me helps individuals communicate better and teams deliver consistent, on-brand experiences.
          </p>
          <p className="mt-3 text-sm text-gray-500 italic">
            Powered by Claude AI. Always review suggestions before sending.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={slackInstallUrl}>
              <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-lg px-8 py-6 shadow-lg shadow-indigo-500/25">
                <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                </svg>
                Add to Slack - Free
              </Button>
            </a>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                View Pricing
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Audience Tabs */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Individual Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">For Individuals</h3>
                <p className="text-sm text-gray-500">Personal communication assistant</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">AI-powered response suggestions for difficult messages</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Personal style preferences that match your voice</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Refine suggestions with your specific instructions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Private ephemeral messages - only you see them</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600">Weekly standup report generation</span>
              </li>
            </ul>
            <p className="text-sm text-gray-500 mb-4">Free tier available • No credit card required</p>
          </div>

          {/* Teams Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                TEAMS & ENTERPRISE
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">For Teams & Organizations</h3>
                <p className="text-sm text-gray-500">Client communication excellence</p>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700"><strong>Client Profiles</strong> - Context for every client interaction</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700"><strong>Brand Voice</strong> - Organization-wide tone and messaging</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700"><strong>Escalation Alerts</strong> - Detect frustrated clients early</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700"><strong>Knowledge Base</strong> - AI uses your product/service info</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700"><strong>Team Analytics</strong> - Communication insights & trends</span>
              </li>
            </ul>
            <Link href="/pricing" className="text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1">
              See all team features <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Team Features Deep Dive */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">For Client-Facing Teams</span>
            <h2 className="text-3xl font-bold text-gray-900 mt-2 inline-block">
              Enterprise Communication Management
              <BrushUnderline className="w-full mt-1 opacity-50" />
            </h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              Everything you need to ensure your team communicates consistently, professionally, and on-brand with every client.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Client Management */}
            <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle>Client Profiles</CardTitle>
                <CardDescription>
                  Store client context, preferences, service details, and history. AI automatically uses this when generating suggestions for their contacts.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Brand Voice */}
            <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center mb-4">
                  <Megaphone className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Brand Voice Templates</CardTitle>
                <CardDescription>
                  Define your organization&apos;s tone, approved phrases, and response patterns. Every suggestion aligns with your brand guidelines.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Knowledge Base */}
            <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <Library className="w-6 h-6 text-emerald-600" />
                </div>
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>
                  Upload product docs, service details, and policies. AI references this when answering client questions - always accurate.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Escalation Detection */}
            <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle>Escalation Detection</CardTitle>
                <CardDescription>
                  AI monitors for frustrated or upset clients. Get alerts before situations escalate, with de-escalation response suggestions.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Response Templates */}
            <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-xl flex items-center justify-center mb-4">
                  <FileBox className="w-6 h-6 text-amber-600" />
                </div>
                <CardTitle>Response Templates</CardTitle>
                <CardDescription>
                  Create shared templates with approval workflows. Team members submit, admins approve. AI matches templates to conversations.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Content Guardrails */}
            <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-gray-200 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-slate-600" />
                </div>
                <CardTitle>Content Guardrails</CardTitle>
                <CardDescription>
                  Block sensitive topics, competitor mentions, or unapproved pricing. AI respects your content policies automatically.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Analytics & Insights</span>
              <h2 className="text-3xl font-bold text-gray-900 mt-2 mb-6">
                Understand Your Team&apos;s Communication
              </h2>
              <p className="text-gray-600 mb-8">
                Get visibility into communication patterns, sentiment trends, and team performance with comprehensive analytics dashboards.
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Communication Insights</h3>
                    <p className="text-gray-600 text-sm">Topic trends, sentiment analysis, channel hotspots, and escalation rates.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Satisfaction Tracking</h3>
                    <p className="text-gray-600 text-sm">NPS surveys, health scores, before/after comparisons, and feedback trends.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Auto-Learning</h3>
                    <p className="text-gray-600 text-sm">AI learns from accepted suggestions and proposes knowledge base entries for review.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <ScrollText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Compliance Audit Trail</h3>
                    <p className="text-gray-600 text-sm">Track all AI-assisted responses, export data, and maintain GDPR compliance.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">Team Analytics</h4>
                  <span className="text-xs text-gray-500">Last 30 days</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-indigo-600">847</p>
                    <p className="text-sm text-gray-600">Suggestions Generated</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-emerald-600">73%</p>
                    <p className="text-sm text-gray-600">Acceptance Rate</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-purple-600">+42</p>
                    <p className="text-sm text-gray-600">NPS Score</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-amber-600">2.3s</p>
                    <p className="text-sm text-gray-600">Avg Response Time</p>
                  </div>
                </div>
                <div className="h-32 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-12 h-12 text-indigo-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Simplified */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 inline-block">
              How It Works
              <BrushUnderline className="w-full mt-1 opacity-50" />
            </h2>
            <p className="mt-4 text-gray-600">Three simple ways to get AI-powered response suggestions</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <MessageSquare className="w-8 h-8 text-indigo-600" />
                </div>
                <CardTitle>1. Watch Conversations</CardTitle>
                <CardDescription>
                  Use /speakforme-watch in any channel or DM. The AI monitors and suggests responses when needed.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle>2. Get Suggestions</CardTitle>
                <CardDescription>
                  Receive private, ephemeral suggestions when someone sends a message that needs a response.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white border-gray-200/50 shadow-sm hover:shadow-md transition-shadow text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-pink-600" />
                </div>
                <CardTitle>3. Review & Send</CardTitle>
                <CardDescription>
                  Copy, refine, or dismiss. You&apos;re always in control of what gets sent.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <p className="text-4xl font-bold">10K+</p>
              <p className="text-indigo-200 mt-1">Suggestions Generated</p>
            </div>
            <div>
              <p className="text-4xl font-bold">73%</p>
              <p className="text-indigo-200 mt-1">Avg Acceptance Rate</p>
            </div>
            <div>
              <p className="text-4xl font-bold">2.3s</p>
              <p className="text-indigo-200 mt-1">Avg Response Time</p>
            </div>
            <div>
              <p className="text-4xl font-bold">99.9%</p>
              <p className="text-indigo-200 mt-1">Uptime</p>
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
          Ready to transform your team&apos;s communication?
          <BrushUnderline className="w-full mt-1 opacity-50" />
        </h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Join teams who use Speak for Me to deliver consistent, on-brand client experiences while helping individuals communicate with confidence.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href={slackInstallUrl}>
            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              Add to Slack - Free
            </Button>
          </a>
          <Link href="/pricing">
            <Button size="lg" variant="outline">
              Compare Plans
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer with legal links */}
      <Footer />
    </div>
  );
}
