import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { PricingTable } from '@/components/pricing/pricing-table';
import { JsonLd } from '@/components/seo/json-ld';
import {
  softwareAppSchema,
  organizationSchema,
  createSpeakableSchema,
} from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Pricing - Speak for Me',
  description:
    'Simple, transparent pricing for AI-powered Slack response suggestions. Individual plans from $10/month or team plans from $10/seat/month. Start with a 14-day free trial.',
  openGraph: {
    title: 'Pricing - Speak for Me',
    description:
      'Simple, transparent pricing for individuals and teams. AI-powered Slack response suggestions. Start with a 14-day free trial.',
    type: 'website',
  },
};

export default function PricingPage() {
  const slackInstallUrl = process.env.NEXT_PUBLIC_SLACK_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_SLACK_BACKEND_URL}/slack/install`
    : '/slack/install';

  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      {/* JSON-LD Structured Data */}
      <JsonLd data={softwareAppSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd
        data={createSpeakableSchema([
          '#pricing-headline',
          '#pricing-subheadline',
        ])}
      />

      {/* Navigation */}
      <nav className="border-b border-gray-200/50 bg-[#FFFDF7]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Speak for Me"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="font-bold text-xl text-gray-900">Speak for Me</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <a href={slackInstallUrl}>
                <Button className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
                  <svg
                    className="w-5 h-5 mr-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                  Add to Slack
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1
          id="pricing-headline"
          className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl"
        >
          Stop Agonizing Over Difficult Messages
        </h1>
        <p
          id="pricing-subheadline"
          className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto"
        >
          Spend 30 seconds instead of 30 minutes crafting the perfect response.
          Start with a 14-day free trial — no credit card required.
        </p>
      </section>

      {/* Value Props */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid sm:grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div className="text-3xl font-bold text-indigo-600 mb-1">~$0.35</div>
            <p className="text-sm text-gray-600">per difficult message handled</p>
          </div>
          <div className="p-4">
            <div className="text-3xl font-bold text-indigo-600 mb-1">15+ min</div>
            <p className="text-sm text-gray-600">saved per response on average</p>
          </div>
          <div className="p-4">
            <div className="text-3xl font-bold text-indigo-600 mb-1">100%</div>
            <p className="text-sm text-gray-600">your voice, your style</p>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <Suspense fallback={
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto animate-pulse">
            <div className="h-96 bg-gray-100 rounded-xl" />
            <div className="h-96 bg-gray-100 rounded-xl" />
          </div>
        }>
          <PricingTable />
        </Suspense>
      </section>

      {/* Use Cases */}
      <section className="bg-gradient-to-b from-white to-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Perfect For
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Responding to frustrated customers',
              'Navigating office politics',
              'Giving constructive feedback',
              'Declining requests diplomatically',
              'Following up without being pushy',
              'Handling sensitive topics',
            ].map((useCase) => (
              <div key={useCase} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
                <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                <span className="text-gray-700">{useCase}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Questions? We&apos;ve got answers
          </h2>
          <p className="text-gray-600 mb-6">
            Check out our FAQ or reach out to our support team.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/#faq">
              <Button variant="outline">View FAQ</Button>
            </Link>
            <a href="mailto:support@speakforme.app">
              <Button variant="ghost">Contact Support</Button>
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Your first difficult message is on us
        </h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Join teams who use Speak for Me to handle difficult workplace
          conversations with confidence.
        </p>
        <a href={slackInstallUrl}>
          <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-indigo-500/25">
            Add to Slack - Start Free Trial
          </Button>
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/50 bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Speak for Me"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="font-semibold text-gray-900">Speak for Me</span>
            </Link>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/pricing" className="hover:text-gray-900">
                Pricing
              </Link>
              <Link href="/#faq" className="hover:text-gray-900">
                FAQ
              </Link>
              <a href="mailto:support@speakforme.app" className="hover:text-gray-900">
                Support
              </a>
            </div>
            <p className="text-gray-500 text-sm">Powered by Claude AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
