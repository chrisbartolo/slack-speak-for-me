import Link from 'next/link';
import Image from 'next/image';

/**
 * Footer component with legal links
 * Displays Privacy Policy and Terms of Service links
 * Used on public pages (landing page, pricing, etc.)
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200/50 bg-white py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Speak for Me"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-semibold text-gray-900">Speak for Me</span>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-gray-900 transition-colors">
              FAQ
            </Link>
            <a href="mailto:support@speakforme.app" className="hover:text-gray-900 transition-colors">
              Support
            </a>
            <span className="text-gray-300">|</span>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              Terms of Service
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-gray-400 text-sm">
            &copy; {currentYear} Speak for Me. Powered by Claude AI.
          </p>
        </div>
      </div>
    </footer>
  );
}
