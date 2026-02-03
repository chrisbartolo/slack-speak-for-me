import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Support - Speak for Me',
  description: 'Get help with Speak for Me. Contact support, browse FAQs, and find troubleshooting guides.',
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#FFFDF7]">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Support</h1>
        <p className="text-gray-600 mb-12">We&apos;re here to help. Reach out and we&apos;ll respond within 2 business days.</p>

        <div className="prose prose-gray max-w-none">
          {/* Contact Us */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-600 mb-4">
              For any questions, issues, or feedback, please reach out via email:
            </p>
            <ul className="list-none space-y-2 text-gray-600 pl-0">
              <li><strong>General Support:</strong>{' '}
                <a href="mailto:support@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  support@speakforme.app
                </a>
              </li>
              <li><strong>Privacy Concerns:</strong>{' '}
                <a href="mailto:privacy@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  privacy@speakforme.app
                </a>
              </li>
              <li><strong>Legal Inquiries:</strong>{' '}
                <a href="mailto:legal@speakforme.app" className="text-blue-600 hover:text-blue-800 underline">
                  legal@speakforme.app
                </a>
              </li>
            </ul>
          </section>

          {/* Getting Started */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Getting Started</h2>
            <ol className="list-decimal list-inside text-gray-600 space-y-3">
              <li>
                <strong>Install the app</strong> — Click &quot;Add to Slack&quot; from our{' '}
                <Link href="/" className="text-blue-600 hover:text-blue-800 underline">homepage</Link>{' '}
                to add Speak for Me to your workspace.
              </li>
              <li>
                <strong>Watch a conversation</strong> — Type <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/speakforme-watch</code> in
                any channel or DM to start receiving AI suggestions.
              </li>
              <li>
                <strong>Get suggestions</strong> — When someone messages you in a watched conversation,
                you&apos;ll receive a private suggestion only visible to you.
              </li>
              <li>
                <strong>On-demand help</strong> — Right-click any message, select &quot;Help me respond&quot;
                to get an AI suggestion for any message, anytime.
              </li>
            </ol>
          </section>

          {/* Available Commands */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Available Commands</h2>
            <div className="space-y-3 text-gray-600">
              <div>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/speakforme-watch</code>
                <span className="ml-2">Enable AI suggestions for the current conversation</span>
              </div>
              <div>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/speakforme-unwatch</code>
                <span className="ml-2">Stop receiving suggestions for the current conversation</span>
              </div>
              <div>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/speakforme-report</code>
                <span className="ml-2">Generate your weekly standup report</span>
              </div>
              <div>
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/speakforme-tasks</code>
                <span className="ml-2">View pending tasks detected from your messages</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Type <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">help</code> after any command for detailed usage instructions.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">How does Speak for Me work?</h3>
                <p className="text-gray-600">
                  There are three ways to use Speak for Me: mention the bot in a message, use{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-watch</code> to
                  automatically get suggestions in a conversation, or right-click any message and
                  select &quot;Help me respond&quot; for on-demand help.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Is my data private?</h3>
                <p className="text-gray-600">
                  Yes. All suggestions are delivered as ephemeral messages, meaning only you can see them.
                  Your messages are processed temporarily to generate suggestions and are not stored.
                  OAuth tokens are encrypted with AES-256-GCM. See our{' '}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</Link> for details.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Can I control which conversations get suggestions?</h3>
                <p className="text-gray-600">
                  You have full control. Use <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-watch</code> to
                  enable and <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-unwatch</code> to
                  disable suggestions per conversation. Only watched conversations generate suggestions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">What happens when I hit my usage limit?</h3>
                <p className="text-gray-600">
                  Free tier users get 5 suggestions per month. When you reach the limit, you&apos;ll be
                  notified and can upgrade your plan for more. Your usage resets at the start of each month.
                  Visit our <Link href="/pricing" className="text-blue-600 hover:text-blue-800 underline">Pricing page</Link> for plan details.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Can I cancel anytime?</h3>
                <p className="text-gray-600">
                  Yes. You can cancel your subscription at any time with no cancellation fees. You&apos;ll
                  keep access to your plan until the end of the current billing period.
                </p>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Troubleshooting</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">I&apos;m not receiving suggestions</h3>
                <p className="text-gray-600">
                  Make sure you&apos;ve used <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-watch</code> in
                  the conversation. The bot needs to be invited to the channel — try mentioning{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">@Speak for Me</code> in the channel first.
                  Suggestions are only triggered when someone else messages in a watched conversation.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">The bot says &quot;Workspace not found&quot;</h3>
                <p className="text-gray-600">
                  This usually means the app needs to be reinstalled. Have a workspace admin reinstall
                  Speak for Me from our{' '}
                  <Link href="/" className="text-blue-600 hover:text-blue-800 underline">homepage</Link>.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Commands aren&apos;t working</h3>
                <p className="text-gray-600">
                  Ensure you&apos;re using the correct command names:{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-watch</code>,{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-unwatch</code>,{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-report</code>, and{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">/speakforme-tasks</code>.
                  If commands still don&apos;t appear, the app may need to be reinstalled.
                </p>
              </div>
            </div>
          </section>

          {/* AI Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">About AI-Generated Suggestions</h2>
            <p className="text-gray-600 mb-4">
              Speak for Me uses Claude AI by Anthropic to generate response suggestions. Please keep in mind:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>AI-generated suggestions may not always be accurate or appropriate</li>
              <li>Always review suggestions before sending them</li>
              <li>You are responsible for any messages you choose to send</li>
              <li>Suggestions do not constitute legal, HR, or professional advice</li>
              <li>We never send messages on your behalf — you must explicitly choose to send</li>
            </ul>
          </section>

          {/* Links */}
          <section className="mb-10 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/privacy" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</Link>
              <Link href="/terms" className="text-blue-600 hover:text-blue-800 underline">Terms of Service</Link>
              <Link href="/docs" className="text-blue-600 hover:text-blue-800 underline">Documentation</Link>
              <Link href="/pricing" className="text-blue-600 hover:text-blue-800 underline">Pricing</Link>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
