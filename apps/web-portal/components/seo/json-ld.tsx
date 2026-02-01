import type { Thing, WithContext } from 'schema-dts';

interface JsonLdProps {
  data: WithContext<Thing>;
}

/**
 * JSON-LD structured data injection component
 *
 * Renders a script tag with type="application/ld+json" containing
 * the provided schema.org structured data.
 *
 * XSS Protection: Escapes < characters to prevent script injection
 * when schema contains user-provided content.
 */
export function JsonLd({ data }: JsonLdProps) {
  // XSS protection: Replace < with Unicode escape to prevent
  // closing the script tag via malicious content
  const jsonLd = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}
