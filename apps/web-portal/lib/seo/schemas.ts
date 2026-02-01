import type {
  WithContext,
  WebApplication,
  FAQPage,
  Organization,
  WebPage,
} from 'schema-dts';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

/**
 * SoftwareApplication JSON-LD schema for the pricing page
 * Helps search engines understand pricing and product details
 */
export const softwareAppSchema: WithContext<WebApplication> = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Speak for Me',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  description:
    'AI-powered Slack response assistant that helps professionals craft contextually-aware responses to challenging workplace messages using Claude AI.',
  url: baseUrl,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '10',
    highPrice: '15',
    priceCurrency: 'USD',
    offerCount: 2,
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '10',
        priceCurrency: 'USD',
        description: 'AI response suggestions, watch up to 5 channels, copy to clipboard, basic refinement',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '10',
          priceCurrency: 'USD',
          unitText: 'seat/month',
        },
      },
      {
        '@type': 'Offer',
        name: 'Pro',
        price: '15',
        priceCurrency: 'USD',
        description: 'Everything in Starter plus unlimited channels, style learning, weekly reports, priority support',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '15',
          priceCurrency: 'USD',
          unitText: 'seat/month',
        },
      },
    ],
  },
  featureList: [
    'AI response suggestions',
    'Context-aware responses',
    'Style learning',
    'Weekly reports',
    'Slack integration',
  ],
  screenshot: `${baseUrl}/images/feature-showcase.png`,
  softwareVersion: '1.0',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '50',
  },
};

/**
 * Organization JSON-LD schema for brand knowledge panel
 * Improves brand visibility in search results
 */
export const organizationSchema: WithContext<Organization> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Speak for Me',
  url: baseUrl,
  logo: `${baseUrl}/images/emblem.png`,
  description:
    'AI-powered workplace communication assistant that helps professionals respond to challenging messages with confidence.',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'support@speakforme.app',
  },
};

/**
 * FAQ content for landing page
 */
export interface FAQItem {
  question: string;
  answer: string;
}

export const faqItems: FAQItem[] = [
  {
    question: 'How does Speak for Me work?',
    answer:
      'Speak for Me offers three ways to get AI-powered response suggestions: (1) @mention the bot in any channel to get help with a specific message, (2) use the /watch command to monitor conversations and receive automatic suggestions when someone replies, or (3) right-click any message and select "Help me respond" for instant assistance.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes, completely. All suggestions are delivered as ephemeral messages - only you can see them. No one else in your workspace can see the AI assistance. Your conversation data is encrypted and we never share it with third parties.',
  },
  {
    question: 'How does the free trial work?',
    answer:
      'You get 14 days of full access to all features with no credit card required. During the trial, your entire team can use all features including AI suggestions, conversation watching, and weekly reports. At the end of the trial, you can subscribe to continue or your access will pause.',
  },
  {
    question: 'What happens when my trial ends?',
    answer:
      "When your trial ends, you'll need to add a payment method to continue using Speak for Me. If you don't subscribe, your account pauses but your data is preserved. You can reactivate anytime by starting a subscription.",
  },
  {
    question: 'How does per-seat pricing work?',
    answer:
      "You only pay for active users who actually use Speak for Me each billing period. If someone joins mid-month, their charge is prorated. If someone stops using the service, they won't be charged the following month. This ensures you only pay for the value you receive.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      "Yes, you can cancel your subscription at any time through the Customer Portal. When you cancel, you'll retain access to all features until the end of your current billing period. There are no cancellation fees or long-term commitments.",
  },
];

/**
 * FAQ JSON-LD schema for rich search results
 * Enables FAQ rich snippets in Google search
 */
export const faqSchema: WithContext<FAQPage> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question' as const,
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer' as const,
      text: item.answer,
    },
  })),
};

/**
 * Creates a Speakable schema for marking content readable by voice assistants
 * @param selectors - CSS selectors for speakable content
 * @returns WebPage schema with SpeakableSpecification
 */
export function createSpeakableSchema(selectors: string[]): WithContext<WebPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: selectors,
    },
  };
}
