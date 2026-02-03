import type { Metadata } from 'next';
import { SiteNav } from '@/components/site-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using Speak for Me, the AI-powered Slack response assistant.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-12">Last updated: February 1, 2026</p>

        <div className="prose prose-gray max-w-none">
          {/* Agreement to Terms */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Agreement to Terms</h2>
            <p className="text-gray-600 mb-4">
              These Terms of Service ("Terms") constitute a legally binding agreement between you and
              Speak for Me ("Company," "we," "us," or "our") concerning your access to and use of the
              Speak for Me service.
            </p>
            <p className="text-gray-600">
              By accessing or using our service, you agree to be bound by these Terms. If you disagree
              with any part of the Terms, you may not access the service.
            </p>
          </section>

          {/* Description of Service */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description of Service</h2>
            <p className="text-gray-600 mb-4">
              Speak for Me is an AI-powered Slack integration that provides:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Response Suggestions:</strong> AI-generated suggestions for responding to challenging workplace messages</li>
              <li><strong>Style Personalization:</strong> Learning your communication preferences to tailor suggestions</li>
              <li><strong>Conversation Watching:</strong> Monitoring specified channels for replies requiring responses</li>
              <li><strong>Weekly Reports:</strong> Automated generation of standup reports from workflow data</li>
              <li><strong>Ephemeral Delivery:</strong> Private suggestions visible only to you</li>
            </ul>
          </section>

          {/* Eligibility */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Eligibility</h2>
            <p className="text-gray-600 mb-4">
              To use Speak for Me, you must:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Be an authorized member of a Slack workspace</li>
              <li>Have permission to install third-party apps (for workspace administrators)</li>
              <li>Be at least 18 years of age or the age of legal majority in your jurisdiction</li>
              <li>Have the legal authority to enter into these Terms</li>
            </ul>
            <p className="text-gray-600 mt-4">
              By using the service, you represent and warrant that you meet all eligibility requirements.
            </p>
          </section>

          {/* Account Registration */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Account Registration</h2>
            <p className="text-gray-600 mb-4">
              Access to Speak for Me is provided through Slack OAuth authentication. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Provide accurate and complete information during the OAuth process</li>
              <li>Maintain the security of your Slack account credentials</li>
              <li>Promptly notify us of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptable Use</h2>
            <p className="text-gray-600 mb-4">
              You agree NOT to use Speak for Me to:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Harass, bully, threaten, or intimidate others</li>
              <li>Generate spam, unsolicited messages, or automated bulk communications</li>
              <li>Engage in any illegal activities or violate applicable laws</li>
              <li>Impersonate others or misrepresent your identity</li>
              <li>Circumvent, disable, or interfere with security features</li>
              <li>Reverse engineer, decompile, or attempt to extract source code</li>
              <li>Violate Slack's Terms of Service or Acceptable Use Policy</li>
              <li>Interfere with or disrupt the service or connected networks</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Attempt to gain unauthorized access to any systems</li>
            </ul>
          </section>

          {/* AI-Generated Content */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI-Generated Content</h2>
            <p className="text-gray-600 mb-4">
              Important disclosures about AI-generated suggestions:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Not Guaranteed Accurate:</strong> AI suggestions may contain errors, inaccuracies, or inappropriate content</li>
              <li><strong>Review Required:</strong> You are responsible for reviewing all suggestions before sending</li>
              <li><strong>No Auto-Send:</strong> We never send messages on your behalf; you must explicitly copy and send</li>
              <li><strong>Your Responsibility:</strong> You assume full responsibility for any messages you choose to send</li>
              <li><strong>Not Professional Advice:</strong> Suggestions do not constitute legal, HR, or professional advice</li>
            </ul>
            <p className="text-gray-600 mt-4">
              We strongly recommend always reviewing AI suggestions carefully and editing them to ensure
              they appropriately convey your intended message before sending.
            </p>
          </section>

          {/* Intellectual Property */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Our Intellectual Property</h3>
            <p className="text-gray-600 mb-4">
              The service, including its original content, features, and functionality, is owned by
              Speak for Me and is protected by copyright, trademark, and other intellectual property laws.
              Our trademarks and trade dress may not be used without prior written consent.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Your Content</h3>
            <p className="text-gray-600 mb-4">
              You retain ownership of any content you provide to the service, including your messages,
              preferences, and feedback. By using the service, you grant us a limited license to process
              this content solely to provide the service features.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">AI-Generated Suggestions</h3>
            <p className="text-gray-600">
              You may freely use, modify, and send AI-generated suggestions. We do not claim ownership
              over suggestions generated for you.
            </p>
          </section>

          {/* Payment Terms */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Payment Terms</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Subscription Billing</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Paid plans are billed in advance on a monthly or annual basis</li>
              <li>Subscription fees are non-refundable except as required by law</li>
              <li>You authorize us to charge your payment method for recurring fees</li>
              <li>Prices may change with 30 days notice</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Free Trials</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Free trials may be offered at our discretion</li>
              <li>You will be notified before your trial ends</li>
              <li>You must cancel before trial end to avoid charges</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Cancellation</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>You may cancel your subscription at any time through your dashboard</li>
              <li>Cancellation takes effect at the end of the current billing period</li>
              <li>You will retain access until the end of your paid period</li>
            </ul>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-600 mb-4 font-medium">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind</li>
              <li>We do not warrant that AI suggestions will be accurate, appropriate, or error-free</li>
              <li>We are not responsible for any outcomes resulting from messages you choose to send</li>
              <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
              <li>Our total liability shall not exceed the amount paid by you in the 12 months prior to the claim</li>
            </ul>
            <p className="text-gray-600 mt-4">
              Some jurisdictions do not allow limitation of certain warranties or liabilities, so
              some of the above limitations may not apply to you.
            </p>
          </section>

          {/* Indemnification */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Indemnification</h2>
            <p className="text-gray-600">
              You agree to indemnify, defend, and hold harmless Speak for Me and its affiliates,
              officers, directors, employees, and agents from any claims, damages, losses, liabilities,
              and expenses (including legal fees) arising out of or related to your use of the service,
              your violation of these Terms, or your violation of any rights of another party.
            </p>
          </section>

          {/* Termination */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">By You</h3>
            <p className="text-gray-600 mb-4">
              You may terminate your account at any time by disconnecting the Slack integration or
              contacting us. Upon termination, your right to use the service will immediately cease.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">By Us</h3>
            <p className="text-gray-600 mb-4">
              We may terminate or suspend your access immediately, without prior notice, for any reason,
              including breach of these Terms. We may also terminate the service entirely with 30 days notice.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">Effect of Termination</h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Your right to use the service terminates immediately</li>
              <li>We will delete your data according to our Privacy Policy</li>
              <li>Any pending subscription payments are non-refundable (except as required by law)</li>
              <li>Provisions that should survive termination will remain in effect</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
            <p className="text-gray-600">
              We reserve the right to modify these Terms at any time. We will notify you of material
              changes by posting the new Terms on this page and updating the "Last updated" date.
              For significant changes, we will provide additional notice via email or through the service.
              Your continued use of the service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Governing Law</h2>
            <p className="text-gray-600 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of Malta,
              without regard to its conflict of law provisions.
            </p>
            <p className="text-gray-600">
              Any disputes arising from these Terms or your use of the service shall be subject to
              the exclusive jurisdiction of the courts of Malta.
            </p>
          </section>

          {/* Severability */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Severability</h2>
            <p className="text-gray-600">
              If any provision of these Terms is held to be unenforceable or invalid, such provision
              will be changed and interpreted to accomplish the objectives of such provision to the
              greatest extent possible under applicable law, and the remaining provisions will continue
              in full force and effect.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-4">
              If you have any questions about these Terms, please contact us:
            </p>
            <ul className="list-none text-gray-600 space-y-2">
              <li><strong>Email:</strong>{' '}
                <a href="mailto:legal@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  legal@speakforme.app
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
