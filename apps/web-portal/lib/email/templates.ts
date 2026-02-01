const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://speakforme.app';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function trialEndingEmail(daysRemaining: number): EmailTemplate {
  const subject = `Your Speak for Me trial ends in ${daysRemaining} days`;
  const html = `
    <h1>Your trial is ending soon</h1>
    <p>Your 14-day free trial of Speak for Me will end in <strong>${daysRemaining} days</strong>.</p>
    <p>To continue using AI-powered response suggestions without interruption, add a payment method now.</p>
    <p><a href="${baseUrl}/admin/billing" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Add Payment Method</a></p>
    <p>If you don't add a payment method, your subscription will be paused and you'll lose access to the app features.</p>
    <p>Questions? Reply to this email - we're here to help!</p>
  `;
  const text = `Your trial is ending soon\n\nYour 14-day free trial of Speak for Me will end in ${daysRemaining} days.\n\nTo continue using AI-powered response suggestions without interruption, add a payment method: ${baseUrl}/admin/billing\n\nIf you don't add a payment method, your subscription will be paused.`;

  return { subject, html, text };
}

export function subscriptionPausedEmail(): EmailTemplate {
  const subject = 'Your Speak for Me subscription has been paused';
  const html = `
    <h1>Your subscription is paused</h1>
    <p>Your trial has ended and we don't have a payment method on file, so your Speak for Me subscription has been paused.</p>
    <p>Your data is safe, but you won't be able to use the app features until you add a payment method.</p>
    <p><a href="${baseUrl}/admin/billing" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Resume Subscription</a></p>
    <p>When you add a payment method, your subscription will resume immediately.</p>
  `;
  const text = `Your subscription is paused\n\nYour trial has ended and we don't have a payment method on file.\n\nAdd a payment method to resume: ${baseUrl}/admin/billing`;

  return { subject, html, text };
}

export function paymentFailedEmail(invoiceUrl?: string): EmailTemplate {
  const subject = 'Payment failed for your Speak for Me subscription';
  const html = `
    <h1>We couldn't process your payment</h1>
    <p>We tried to charge your payment method for your Speak for Me subscription, but the payment was declined.</p>
    <p>Please update your payment method to avoid any interruption to your service.</p>
    <p><a href="${baseUrl}/admin/billing" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
    ${invoiceUrl ? `<p>You can also <a href="${invoiceUrl}">view your invoice</a> directly.</p>` : ''}
    <p>We'll automatically retry the payment in a few days. If you need help, just reply to this email.</p>
  `;
  const text = `Payment failed\n\nWe couldn't process your payment for Speak for Me.\n\nUpdate your payment method: ${baseUrl}/admin/billing`;

  return { subject, html, text };
}

export function subscriptionResumedEmail(): EmailTemplate {
  const subject = 'Your Speak for Me subscription is now active';
  const html = `
    <h1>Welcome back!</h1>
    <p>Your Speak for Me subscription is now active. You have full access to all features again.</p>
    <p><a href="${baseUrl}/dashboard" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
    <p>Thank you for being a Speak for Me customer!</p>
  `;
  const text = `Welcome back!\n\nYour Speak for Me subscription is now active.\n\nGo to your dashboard: ${baseUrl}/dashboard`;

  return { subject, html, text };
}
