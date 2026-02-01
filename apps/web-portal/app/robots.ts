import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

/**
 * Dynamic robots.txt generation for SEO
 * Controls which pages search engines should crawl
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/pricing'],
      disallow: ['/dashboard/', '/admin/', '/api/', '/callback', '/install/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
