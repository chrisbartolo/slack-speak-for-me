'use client';

import CookieConsent from 'react-cookie-consent';
import Link from 'next/link';

export function CookieConsentBanner() {
  return (
    <CookieConsent
      location="bottom"
      cookieName="cookie-consent"
      expires={365}
      enableDeclineButton
      flipButtons
      buttonText="Accept All"
      declineButtonText="Essential Only"
      onAccept={() => {
        // Placeholder for future analytics initialization
        // e.g., initializeAnalytics();
      }}
      onDecline={() => {
        // Placeholder for analytics opt-out
        // e.g., disableAnalytics();
      }}
      style={{
        background: '#1e293b',
        alignItems: 'center',
        padding: '16px 24px',
      }}
      contentStyle={{
        flex: '1 0 300px',
        margin: '0',
      }}
      buttonStyle={{
        background: '#3b82f6',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '500',
        borderRadius: '6px',
        padding: '10px 20px',
        margin: '8px',
      }}
      declineButtonStyle={{
        background: 'transparent',
        color: '#e2e8f0',
        fontSize: '14px',
        fontWeight: '500',
        borderRadius: '6px',
        border: '1px solid #475569',
        padding: '10px 20px',
        margin: '8px',
      }}
    >
      <span className="text-slate-200 text-sm">
        We use cookies to enhance your experience. By continuing to visit this
        site you agree to our use of cookies.{' '}
        <Link
          href="/privacy"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Learn more
        </Link>
      </span>
    </CookieConsent>
  );
}
