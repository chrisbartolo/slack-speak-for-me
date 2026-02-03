import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Sub-Processors - Speak for Me',
  description: 'List of third-party sub-processors used by Speak for Me to deliver our AI-powered Slack response suggestion service.',
};

export default function SubProcessorsPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Sub-Processors</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: February 3, 2026</p>

        <div className="prose prose-gray max-w-none">
          {/* Introduction */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Overview</h2>
            <p className="text-gray-600 mb-4">
              Speak for Me uses a limited number of third-party service providers (sub-processors) to deliver
              our AI-powered response suggestion service. This page lists all sub-processors that may process
              user data on our behalf.
            </p>
            <p className="text-gray-600">
              We are committed to transparency about how your data is handled and by whom. Each sub-processor
              is contractually bound to process data only as instructed by us and in accordance with applicable
              data protection laws.
            </p>
          </section>

          {/* Sub-processors Table */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Current Sub-Processors</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-600 border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 pr-4 font-semibold text-gray-900">Sub-Processor</th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-900">Purpose</th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-900">Data Processed</th>
                    <th className="text-left py-3 pr-4 font-semibold text-gray-900">Location</th>
                    <th className="text-left py-3 font-semibold text-gray-900">Privacy Policy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">Anthropic</td>
                    <td className="py-3 pr-4">AI response generation via Claude API</td>
                    <td className="py-3 pr-4">Conversation context, message content (processed per-request, not stored)</td>
                    <td className="py-3 pr-4">United States</td>
                    <td className="py-3">
                      <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        View
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">DigitalOcean</td>
                    <td className="py-3 pr-4">Infrastructure and database hosting</td>
                    <td className="py-3 pr-4">All application and database data</td>
                    <td className="py-3 pr-4">United States (NYC region)</td>
                    <td className="py-3">
                      <a href="https://www.digitalocean.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        View
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">Stripe</td>
                    <td className="py-3 pr-4">Payment processing and subscription management</td>
                    <td className="py-3 pr-4">Billing email, payment details, subscription status</td>
                    <td className="py-3 pr-4">United States</td>
                    <td className="py-3">
                      <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        View
                      </a>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-900">Google</td>
                    <td className="py-3 pr-4">Optional Sheets integration for weekly reports</td>
                    <td className="py-3 pr-4">Google OAuth tokens, spreadsheet data (only if user opts in)</td>
                    <td className="py-3 pr-4">United States</td>
                    <td className="py-3">
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                        View
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Commitments */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Commitments</h2>
            <p className="text-gray-600 mb-4">
              We require all sub-processors to meet the following standards:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Contractual obligations</strong> — Each sub-processor is bound by data processing agreements that limit how they may use your data</li>
              <li><strong>Security standards</strong> — Sub-processors must maintain industry-standard security practices including encryption in transit and at rest</li>
              <li><strong>Data minimization</strong> — We share only the minimum data necessary for each sub-processor to perform its function</li>
              <li><strong>Purpose limitation</strong> — Sub-processors may only process data for the specific purposes outlined above</li>
              <li><strong>Compliance</strong> — Sub-processors must comply with applicable data protection regulations including GDPR where applicable</li>
            </ul>
          </section>

          {/* Changes */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Sub-Processors</h2>
            <p className="text-gray-600 mb-4">
              We will update this page when we add or remove sub-processors. Material changes to our
              sub-processor list will be communicated with at least 30 days&apos; notice before the new
              sub-processor begins processing data.
            </p>
            <p className="text-gray-600">
              If you have concerns about a new sub-processor, please contact us at{' '}
              <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                privacy@speakforme.app
              </a>{' '}
              within the notice period.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact</h2>
            <p className="text-gray-600">
              For questions about our sub-processors or data processing practices, contact us at{' '}
              <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                privacy@speakforme.app
              </a>.
            </p>
          </section>

          {/* Links */}
          <section className="mb-10 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</Link>
              <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">Terms of Service</Link>
              <Link href="/gdpr" className="text-blue-600 hover:text-blue-800 underline">GDPR Commitment</Link>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
