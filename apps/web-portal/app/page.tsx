import { JsonLd } from '@/components/seo/json-ld';
import { LandingPageContent } from '@/components/landing/landing-page-content';
import {
  faqSchema,
  organizationSchema,
  createSpeakableSchema,
} from '@/lib/seo/schemas';

/**
 * Landing page - Server component wrapper
 * Includes JSON-LD schemas in initial HTML for SEO
 * Client-side interactivity handled by LandingPageContent
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white overflow-auto">
      {/* JSON-LD Structured Data - rendered server-side for SEO */}
      <JsonLd data={faqSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd
        data={createSpeakableSchema([
          'h1',
          '.hero-description',
        ])}
      />

      {/* Client-side interactive content */}
      <LandingPageContent />
    </div>
  );
}
