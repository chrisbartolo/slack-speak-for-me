import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'GDPR Commitment - Speak for Me',
  description: 'Our commitment to GDPR compliance. Learn about your data rights, how we protect your data, and how to exercise your rights.',
};

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">GDPR Commitment</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: February 3, 2026</p>

        <div className="prose prose-gray max-w-none">
          {/* Our Commitment */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Commitment</h2>
            <p className="text-gray-600 mb-4">
              Speak for Me is committed to protecting the privacy and rights of all users in accordance with
              the General Data Protection Regulation (GDPR). We process personal data lawfully, fairly, and
              transparently, collecting only what is necessary to deliver our service.
            </p>
            <p className="text-gray-600">
              This page outlines our GDPR compliance practices, your rights as a data subject, and how to
              exercise those rights.
            </p>
          </section>

          {/* Lawful Basis */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Lawful Basis for Processing</h2>
            <p className="text-gray-600 mb-4">
              We process personal data under the following lawful bases:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Contractual necessity</strong> — Processing required to deliver the Speak for Me service as agreed when you install the app (Article 6(1)(b))</li>
              <li><strong>Legitimate interest</strong> — Processing necessary for service improvement, security, and fraud prevention (Article 6(1)(f))</li>
              <li><strong>Consent</strong> — For optional features such as Google Sheets integration and marketing communications (Article 6(1)(a)). You may withdraw consent at any time.</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
            <p className="text-gray-600 mb-4">
              Under the GDPR, you have the following rights regarding your personal data:
            </p>
            <ul className="list-none text-gray-600 space-y-4 pl-0">
              <li>
                <strong>Right of Access (Article 15)</strong>
                <p className="mt-1">You can request a copy of all personal data we hold about you. Use the data export feature in your dashboard or email us.</p>
              </li>
              <li>
                <strong>Right to Rectification (Article 16)</strong>
                <p className="mt-1">You can update or correct your personal data through your dashboard settings at any time.</p>
              </li>
              <li>
                <strong>Right to Erasure (Article 17)</strong>
                <p className="mt-1">You can request deletion of all your personal data. This can be done through the self-service deletion endpoint or by contacting us.</p>
              </li>
              <li>
                <strong>Right to Restriction of Processing (Article 18)</strong>
                <p className="mt-1">You can request that we limit how we process your data in certain circumstances.</p>
              </li>
              <li>
                <strong>Right to Data Portability (Article 20)</strong>
                <p className="mt-1">You can export your data in a structured, machine-readable JSON format via the data export feature.</p>
              </li>
              <li>
                <strong>Right to Object (Article 21)</strong>
                <p className="mt-1">You can object to processing based on legitimate interest. Contact us and we will assess your request.</p>
              </li>
            </ul>
          </section>

          {/* Exercising Your Rights */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Exercising Your Rights</h2>
            <p className="text-gray-600 mb-4">
              You can exercise your data rights through the following methods:
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Self-Service (Recommended)</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Data export</strong> — Download all your data as JSON from your dashboard settings</li>
              <li><strong>Data deletion</strong> — Request complete account deletion from your dashboard settings</li>
              <li><strong>Update preferences</strong> — Modify your style preferences, watched conversations, and notification settings directly</li>
              <li><strong>Unwatch conversations</strong> — Use <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-unwatch</code> to stop AI processing for any conversation</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Email Request</h3>
            <p className="text-gray-600 mb-4">
              Contact{' '}
              <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                privacy@speakforme.app
              </a>{' '}
              with your request. We will verify your identity and respond within 30 days. Complex requests
              may take up to 60 days with prior notification.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">App Uninstall</h3>
            <p className="text-gray-600">
              When a workspace admin uninstalls Speak for Me, all workspace data is automatically deleted.
              This includes user preferences, watched conversations, suggestion history, task data, and
              all associated records. OAuth tokens are immediately revoked.
            </p>
          </section>

          {/* Data Processing Details */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Processing Details</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">What We Collect</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Slack profile data</strong> — User ID, display name, email (for account management)</li>
              <li><strong>Message context</strong> — Recent conversation history used to generate suggestions (processed in-memory, not stored)</li>
              <li><strong>User preferences</strong> — Communication style settings, watched conversations</li>
              <li><strong>Usage data</strong> — Suggestion counts, feature usage for billing and service improvement</li>
              <li><strong>Payment data</strong> — Processed by Stripe; we store only billing email and subscription status</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Retention Periods</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Free plan</strong> — Suggestion feedback and usage data retained for 7 days</li>
              <li><strong>Paid plans</strong> — Suggestion feedback and usage data retained for 90 days</li>
              <li><strong>Account data</strong> — Retained while your account is active; deleted within 30 days of account deletion</li>
              <li><strong>Message content</strong> — Processed in-memory only; never persisted to database</li>
              <li><strong>Audit logs</strong> — Retained per plan tier for compliance verification</li>
            </ul>
          </section>

          {/* International Transfers */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">International Data Transfers</h2>
            <p className="text-gray-600 mb-4">
              All data is hosted on DigitalOcean infrastructure in the European Union (Frankfurt, Germany). AI
              processing is performed via Anthropic&apos;s API. Data remains within the EU for storage
              and infrastructure purposes.
            </p>
            <p className="text-gray-600">
              AI request processing via Anthropic may involve data transfer to the US. This is limited
              to per-request conversation context that is processed and not stored. For questions about
              transfer mechanisms, please contact us.
            </p>
          </section>

          {/* Security Measures */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Security Measures</h2>
            <p className="text-gray-600 mb-4">
              We implement robust technical and organizational measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Encryption at rest</strong> — OAuth tokens encrypted with AES-256-GCM</li>
              <li><strong>Encryption in transit</strong> — All data transmitted over TLS 1.3</li>
              <li><strong>Data isolation</strong> — PostgreSQL Row-Level Security (RLS) enforces strict workspace isolation</li>
              <li><strong>Automated cleanup</strong> — Data retention jobs automatically purge expired data</li>
              <li><strong>Access control</strong> — Role-based access with audit logging of all administrative actions</li>
              <li><strong>Secret management</strong> — Application logs automatically redact sensitive values</li>
            </ul>
          </section>

          {/* Breach Notification */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Breach Notification</h2>
            <p className="text-gray-600">
              In the event of a personal data breach that is likely to result in a risk to your rights
              and freedoms, we will notify the relevant supervisory authority within 72 hours of becoming
              aware of the breach, in accordance with Article 33 of the GDPR. Affected users will be
              notified without undue delay when the breach is likely to result in a high risk to their
              rights and freedoms (Article 34).
            </p>
          </section>

          {/* Data Protection Officer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Protection Contact</h2>
            <p className="text-gray-600 mb-4">
              For any questions or concerns about our data protection practices, or to exercise your
              rights under the GDPR, please contact:
            </p>
            <ul className="list-none text-gray-600 space-y-2 pl-0">
              <li><strong>Email:</strong>{' '}
                <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  privacy@speakforme.app
                </a>
              </li>
              <li><strong>Support:</strong>{' '}
                <Link href="/support" className="text-blue-600 hover:text-blue-800 underline">
                  speakforme.app/support
                </Link>
              </li>
            </ul>
            <p className="text-gray-600 mt-4">
              You also have the right to lodge a complaint with your local data protection supervisory
              authority if you believe your data protection rights have been violated.
            </p>
          </section>

          {/* Links */}
          <section className="mb-10 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</Link>
              <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">Terms of Service</Link>
              <Link href="/sub-processors" className="text-blue-600 hover:text-blue-800 underline">Sub-Processors</Link>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
