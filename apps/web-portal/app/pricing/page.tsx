import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { PricingTable } from '@/components/pricing/pricing-table';
import { JsonLd } from '@/components/seo/json-ld';
import {
  softwareAppSchema,
  organizationSchema,
  createSpeakableSchema,
} from '@/lib/seo/schemas';
import { SiteNav } from '@/components/site-nav';
import { Footer } from '@/components/footer';

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
      <SiteNav />

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
            <div className="text-3xl font-bold text-indigo-600 mb-1">~€0.35</div>
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
      <Footer />
    </div>
  );
}
