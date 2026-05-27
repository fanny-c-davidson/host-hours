import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { getTierFromPriceId } from '@/lib/stripe/prices';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // 1. Verify Stripe signature — rejects any non-Stripe or tampered requests
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  // 2. Status-based idempotency (P0.1 fix)
  //
  //    Old approach: insert event record → process → mark processed.
  //    Problem: if processing failed, Stripe retried → duplicate-key error
  //    → returned 200 immediately, silently dropping the retry.
  //
  //    New approach: only skip events already marked 'processed'.
  //    Events with status 'failed' or 'pending' are re-processed on retry.
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('status')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existing?.status === 'processed') {
    return NextResponse.json({ received: true });
  }

  // Upsert with 'processing' — if this is a retry of a failed event,
  // we overwrite the old 'failed' record so we can track the new attempt.
  const { error: upsertError } = await supabase
    .from('webhook_events')
    .upsert(
      {
        stripe_event_id: event.id,
        event_type:      event.type,
        payload:         event as unknown as Record<string, unknown>,
        status:          'processing',
        error:           null,
        processed_at:    null,
      },
      { onConflict: 'stripe_event_id' }
    );

  if (upsertError) {
    console.error('[stripe-webhook] Failed to record event:', upsertError);
    // Return 500 so Stripe retries — we haven't processed yet
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // 3. Process event
  try {
    await handleEvent(supabase, event);

    // Mark as successfully processed
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] Handler error [${event.type}]:`, message);

    // Mark as failed so the next Stripe retry is allowed through
    await supabase
      .from('webhook_events')
      .update({ status: 'failed', error: message })
      .eq('stripe_event_id', event.id);

    // Return 500 to trigger Stripe retry
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Event router ───────────────────────────────────────────────────────────

async function handleEvent(supabase: ServiceClient, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);

    // customer.subscription.created fires when a subscription is first activated
    // (always alongside checkout.session.completed for new subscriptions).
    // It carries the full subscription object inline — no extra API call needed.
    // Shares the same handler as .updated since the logic is identical.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionUpserted(supabase, event.data.object as Stripe.Subscription);

    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);

    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(supabase, event.data.object as Stripe.Invoice);

    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice);

    default:
      break;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function getUserIdFromCustomer(
  supabase: ServiceClient,
  stripeCustomerId: string
): Promise<string> {
  // Primary lookup: our DB (fast, no Stripe API call)
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (data?.user_id) return data.user_id;

  // Fallback: read supabase_user_id from Stripe customer metadata.
  // Needed when customer.subscription.created arrives before
  // checkout.session.completed has written the customer_id to our DB.
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (!customer.deleted && customer.metadata?.supabase_user_id) {
    return customer.metadata.supabase_user_id;
  }

  throw new Error(`No user found for Stripe customer: ${stripeCustomerId}`);
}

// ── Event handlers ─────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  supabase: ServiceClient,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== 'subscription') return;

  // P2 fix: removed stripe.subscriptions.retrieve() from here.
  // That extra API call added latency, consumed rate limit, and caused
  // the whole webhook to fail (and retry) if Stripe's API was slow.
  //
  // Responsibility split:
  //   - checkout.session.completed → save the user_id ↔ customer_id mapping
  //     and the subscription_id. No tier/price data needed here.
  //   - customer.subscription.created → fires alongside checkout completion
  //     and carries the full subscription object inline. handleSubscriptionUpserted()
  //     writes all the tier/price/status data with zero extra API calls.

  const userId =
    session.metadata?.supabase_user_id ??
    ((session as any).subscription_data as any)?.metadata?.supabase_user_id;

  if (!userId) {
    throw new Error('supabase_user_id missing from checkout session metadata');
  }

  // Persist the customer_id mapping so subscription events can look up the
  // user by customer_id. The full subscription details are written by
  // handleSubscriptionUpserted() when customer.subscription.created fires.
  await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id:                userId,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: session.subscription as string,
        canceled_at:            null,
      },
      { onConflict: 'user_id' }
    );
}

// Handles both customer.subscription.created and customer.subscription.updated.
// The Stripe subscription object is delivered inline — no extra API calls needed.
async function handleSubscriptionUpserted(
  supabase: ServiceClient,
  subscription: Stripe.Subscription & Record<string, any>
) {
  const userId = await getUserIdFromCustomer(supabase, subscription.customer as string);

  const priceId = subscription.items.data[0]?.price?.id;
  const tier    = getTierFromPriceId(priceId);

  await supabase
    .from('subscriptions')
    .update({
      tier_id:                tier,
      stripe_subscription_id: subscription.id,
      stripe_price_id:        priceId ?? null,
      status:                 subscription.status as any,
      current_period_start:   new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end:     new Date(subscription.current_period_end   * 1000).toISOString(),
      cancel_at_period_end:   subscription.cancel_at_period_end,
      trial_end:              subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    })
    .eq('user_id', userId);
}

async function handleSubscriptionDeleted(
  supabase: ServiceClient,
  subscription: Stripe.Subscription
) {
  const userId = await getUserIdFromCustomer(supabase, subscription.customer as string);

  // Clear all subscription data — user hits the upgrade wall until they re-subscribe
  await supabase
    .from('subscriptions')
    .update({
      tier_id:                null,
      stripe_subscription_id: null,
      stripe_price_id:        null,
      status:                 'canceled',
      cancel_at_period_end:   false,
      canceled_at:            new Date().toISOString(),
      current_period_start:   null,
      current_period_end:     null,
      trial_end:              null,
    })
    .eq('user_id', userId);
}

async function handleInvoicePaymentSucceeded(
  supabase: ServiceClient,
  invoice: Stripe.Invoice
) {
  if (!invoice.customer) return;

  // customer.subscription.updated fires alongside invoice.payment_succeeded
  // and carries updated period dates. This handler only needs to ensure
  // status is set to 'active' — the period date update is handled there.
  // No subscription retrieve needed.
  const userId = await getUserIdFromCustomer(supabase, invoice.customer as string);

  await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('user_id', userId);
}

async function handleInvoicePaymentFailed(
  supabase: ServiceClient,
  invoice: Stripe.Invoice
) {
  // P0.2 fix: was missing — users who failed renewal stayed 'active' indefinitely
  if (!invoice.customer) return;

  const userId = await getUserIdFromCustomer(supabase, invoice.customer as string);

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('user_id', userId);
}
