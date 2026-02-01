import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: 'Speak for Me - AI-Powered Slack Response Assistant',
    template: '%s | Speak for Me',
  },
  description:
    'Get contextually-aware response suggestions for challenging workplace messages. Speak for Me uses Claude AI to help you communicate professionally and effectively.',
  keywords: [
    'Slack',
    'AI',
    'response assistant',
    'workplace communication',
    'Claude AI',
    'message suggestions',
  ],
  authors: [{ name: 'Speak for Me' }],
  creator: 'Speak for Me',
  publisher: 'Speak for Me',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app'
  ),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Speak for Me',
    title: 'Speak for Me - AI-Powered Slack Response Assistant',
    description:
      'Get contextually-aware response suggestions for challenging workplace messages using Claude AI.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Speak for Me - AI-Powered Slack Response Assistant',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Speak for Me - AI-Powered Slack Response Assistant',
    description:
      'Get contextually-aware response suggestions for challenging workplace messages using Claude AI.',
    images: ['/images/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-full`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
