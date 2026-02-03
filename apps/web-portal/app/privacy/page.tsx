import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how Speak for Me collects, uses, and protects your data. GDPR-compliant privacy practices.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: February 1, 2026</p>

        <div className="prose prose-gray max-w-none">
          {/* Introduction */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-600 mb-4">
              Speak for Me ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our Slack
              integration service.
            </p>
            <p className="text-gray-600">
              By using Speak for Me, you agree to the collection and use of information in accordance with
              this policy. If you do not agree with the terms of this privacy policy, please do not access
              or use our service.
            </p>
          </section>

          {/* What Data We Collect */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">What Data We Collect</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Slack Workspace Data</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Workspace ID and name (for multi-tenant isolation)</li>
              <li>Bot token and access tokens (encrypted)</li>
              <li>Channel names and IDs for watched conversations</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">User Data</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Slack user ID (for authentication and personalization)</li>
              <li>Email address (from OAuth, for account identification)</li>
              <li>Display name (for personalization)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Message Context</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Recent messages in threads where you request assistance (processed temporarily)</li>
              <li>Message content sent to AI for generating suggestions</li>
              <li>Conversation context for relevant response generation</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Style Preferences</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Communication tone preferences (professional, friendly, etc.)</li>
              <li>Preferred phrases and language patterns</li>
              <li>Topics to avoid in suggestions</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Usage Data</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Suggestion feedback (accepted, refined, dismissed)</li>
              <li>Refinement history and instructions</li>
              <li>Feature usage patterns</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Google Integration Data (Optional)</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Google OAuth tokens (encrypted) for Sheets access</li>
              <li>Spreadsheet ID for weekly report automation</li>
              <li>Workflow form data for report generation</li>
            </ul>
          </section>

          {/* How We Use Data */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Data</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>AI-Powered Response Suggestions:</strong> We process message context through Claude AI to generate relevant response suggestions</li>
              <li><strong>Style Learning:</strong> Your preferences and feedback help personalize suggestions to match your communication style</li>
              <li><strong>Weekly Report Generation:</strong> Workflow data is analyzed to create automated standup reports</li>
              <li><strong>Service Improvement:</strong> Aggregated, anonymized usage patterns help us improve the service</li>
              <li><strong>Account Management:</strong> User data enables authentication and feature access</li>
            </ul>
          </section>

          {/* Data Storage and Security */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
            <p className="text-gray-600 mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Encryption:</strong> OAuth tokens are encrypted using AES-256-GCM before storage</li>
              <li><strong>Row-Level Security:</strong> PostgreSQL RLS ensures workspace data isolation</li>
              <li><strong>Secure Infrastructure:</strong> Data is stored on DigitalOcean servers in the NYC region</li>
              <li><strong>Transport Security:</strong> All data in transit is encrypted using TLS 1.3</li>
              <li><strong>Access Controls:</strong> Strict access controls limit data access to essential personnel</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Message Content:</strong> Processed temporarily and not stored after suggestion generation</li>
              <li><strong>Suggestions:</strong> Stored for 90 days to enable feedback tracking</li>
              <li><strong>User Preferences:</strong> Retained while your account is active</li>
              <li><strong>OAuth Tokens:</strong> Retained while integration is connected; deleted upon disconnection</li>
              <li><strong>Account Data:</strong> Deleted within 30 days of account deletion request</li>
            </ul>
          </section>

          {/* Your Rights (GDPR) */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights (GDPR)</h2>
            <p className="text-gray-600 mb-4">
              If you are located in the European Economic Area (EEA), you have certain data protection rights:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
            </ul>
            <p className="text-gray-600 mt-4">
              To exercise these rights, visit your{' '}
              <Link href="/dashboard/settings" className="text-blue-600 hover:text-blue-800 underline">
                dashboard settings
              </Link>{' '}
              or contact us at{' '}
              <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                privacy@speakforme.app
              </a>.
            </p>
          </section>

          {/* Third-Party Services */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-600 mb-4">
              We integrate with the following third-party services, each with their own privacy policies:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>
                <strong>Slack:</strong>{' '}
                <a href="https://slack.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                  Slack Privacy Policy
                </a>
              </li>
              <li>
                <strong>Anthropic (Claude AI):</strong>{' '}
                <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                  Anthropic Privacy Policy
                </a>
              </li>
              <li>
                <strong>Stripe (Payments):</strong>{' '}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                  Stripe Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google (Sheets Integration):</strong>{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                  Google Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookies</h2>
            <p className="text-gray-600 mb-4">
              We use essential cookies to provide our service:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Session Cookies:</strong> Required for authentication and maintaining your logged-in state</li>
              <li><strong>Consent Cookie:</strong> Remembers your cookie consent preferences</li>
            </ul>
            <p className="text-gray-600 mt-4">
              We do not currently use analytics or advertising cookies. If this changes, we will update this
              policy and request your consent.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-600">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting
              the new Privacy Policy on this page and updating the "Last updated" date. For significant changes,
              we will provide additional notice via email or through the service. We encourage you to review
              this Privacy Policy periodically.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <ul className="list-none text-gray-600 space-y-2">
              <li><strong>Email:</strong>{' '}
                <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  privacy@speakforme.app
                </a>
              </li>
              <li><strong>Support:</strong>{' '}
                <a href="mailto:support@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  support@speakforme.app
                </a>
              </li>
            </ul>
          </section>
        </div>

      </div>
      <Footer />
    </div>
  );
}
