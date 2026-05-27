import { NextResponse, type NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { STRIPE_PRICES } from '@/lib/stripe/prices';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate price ID
  const { priceId } = await request.json();
  const validPrices = Object.values(STRIPE_PRICES);
  if (!validPrices.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = createServiceClient() as any;

  // 3. Find or create Stripe customer (P1.1 fix: idempotency key prevents duplicate customers)
  const { data: existingSub } = await serviceClient
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let stripeCustomerId = existingSub?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    // Idempotency key scoped to this user ensures that even if two concurrent
    // requests both find no customer, Stripe deduplicates to a single customer.
    const customer = await stripe.customers.create(
      {
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      },
      {
        idempotencyKey: `create-customer-${user.id}`,
      }
    );
    stripeCustomerId = customer.id;

    // Persist the customer ID. Use upsert so a concurrent request that also
    // created the customer (before idempotency kicked in) doesn't cause a
    // unique-constraint violation — the result is the same customer ID either way.
    await serviceClient
      .from('subscriptions')
      .upsert(
        { user_id: user.id, stripe_customer_id: stripeCustomerId },
        { onConflict: 'user_id' }
      );
  }

  // 4. Create Checkout session
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      // Embedding user ID here allows the webhook handler to identify the user
      // from checkout.session.completed even before the subscription row is fully synced
      metadata: { supabase_user_id: user.id },
    },
    success_url:           `${origin}/settings/billing?success=1`,
    cancel_url:            `${origin}/settings/billing?canceled=1`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
