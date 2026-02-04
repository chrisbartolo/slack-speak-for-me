import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/resend';
import { welcomeSubscriberEmail } from '@/lib/email/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Check if already subscribed
    const existing = await db
      .select()
      .from(schema.emailSubscribers)
      .where(eq(schema.emailSubscribers.email, email))
      .limit(1);

    if (existing.length > 0) {
      // If previously unsubscribed, re-subscribe
      if (existing[0].unsubscribedAt) {
        await db
          .update(schema.emailSubscribers)
          .set({ unsubscribedAt: null, subscribedAt: new Date() })
          .where(eq(schema.emailSubscribers.email, email));
      }
      // Either way, return success (don't reveal subscription status)
      return NextResponse.json({ success: true });
    }

    // Insert new subscriber
    await db.insert(schema.emailSubscribers).values({
      email,
      source: 'landing_page',
    });

    // Send welcome email (non-blocking — don't fail the request if email fails)
    const template = welcomeSubscriberEmail();
    sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    }).catch((err) => {
      console.error('Failed to send welcome email:', err);
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
