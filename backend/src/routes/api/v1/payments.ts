import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
} as any);

// Price IDs will be created dynamically on first use
const PLAN_PRICES: Record<string, { name: string; amount: number; interval: 'month' }> = {
  PRO: { name: 'DeployGuard Pro', amount: 2900, interval: 'month' },       // $29/mo
  ENTERPRISE: { name: 'DeployGuard Enterprise', amount: 9900, interval: 'month' }, // $99/mo
};

// Helper: find or create a Stripe Price for a plan
async function getOrCreatePrice(plan: string): Promise<string> {
  const config = PLAN_PRICES[plan];
  if (!config) throw new Error(`Unknown plan: ${plan}`);

  // Search for existing product
  const products = await stripe.products.list({ limit: 10 });
  let product = products.data.find(p => p.name === config.name && p.active);

  if (!product) {
    product = await stripe.products.create({ name: config.name });
  }

  // Search for existing price on this product
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  let price = prices.data.find(
    p => p.unit_amount === config.amount && p.recurring?.interval === config.interval
  );

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: config.amount,
      currency: 'usd',
      recurring: { interval: config.interval },
    });
  }

  return price.id;
}

// POST /create-checkout-session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { email, plan, promoCode } = req.body;

    if (!email || !plan) {
      return res.status(400).json({ error: 'Email and plan are required.' });
    }

    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ error: 'Invalid plan. Choose PRO or ENTERPRISE.' });
    }

    const priceId = await getOrCreatePrice(plan);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Build checkout session config
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/pricing?success=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}`,
      cancel_url: `${frontendUrl}/pricing?cancelled=true`,
      metadata: { plan, email },
      allow_promotion_codes: true, // Enables Stripe's built-in promo code field
    };

    // If a specific promo code is provided, look it up
    if (promoCode) {
      try {
        const promotionCodes = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        });
        if (promotionCodes.data.length > 0) {
          sessionConfig.discounts = [{ promotion_code: promotionCodes.data[0].id }];
          delete sessionConfig.allow_promotion_codes; // Can't use both
        }
      } catch (e) {
        // Promo code not found, continue without it
        console.warn('Promo code lookup failed:', e);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create checkout session.' });
  }
});

// POST /webhook — Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // In dev without webhook secret, parse the event directly
      event = req.body as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email || session.metadata?.email || '';
        const plan = session.metadata?.plan || 'PRO';
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Get subscription details for period end
        let periodEnd: Date | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId) as any;
          periodEnd = new Date(sub.current_period_end * 1000);
        }

        await prisma.subscription.upsert({
          where: { email },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan,
            status: 'ACTIVE',
            currentPeriodEnd: periodEnd,
          },
          create: {
            email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan,
            status: 'ACTIVE',
            currentPeriodEnd: periodEnd,
          },
        });
        console.log(`✅ Subscription created for ${email} on plan ${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const subId = subscription.id;

        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subId },
        });

        if (existing) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subId },
            data: {
              status: subscription.status === 'active' ? 'ACTIVE' : 
                      subscription.status === 'past_due' ? 'PAST_DUE' : 'CANCELLED',
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const subId = subscription.id;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { status: 'CANCELLED', plan: 'FREE' },
        });
        console.log(`❌ Subscription ${subId} cancelled`);
        break;
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
  }

  return res.status(200).json({ received: true });
});

// GET /subscription/:email — Check subscription status
router.get('/subscription/:email', async (req: Request, res: Response) => {
  try {
    const email = req.params.email as string;
    const subscription = await prisma.subscription.findUnique({
      where: { email },
    });

    if (!subscription || subscription.status !== 'ACTIVE' || subscription.plan === 'FREE') {
      return res.status(200).json({
        plan: 'FREE',
        status: 'ACTIVE',
        features: {
          scansPerMonth: 5,
          privateRepos: false,
          customRules: false,
          prBot: false,
          autoRemediation: false,
          complianceReports: false,
        },
      });
    }

    const isPro = subscription.plan === 'PRO';
    const isEnterprise = subscription.plan === 'ENTERPRISE';

    return res.status(200).json({
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      features: {
        scansPerMonth: -1, // unlimited
        privateRepos: true,
        customRules: true,
        prBot: isEnterprise,
        autoRemediation: isEnterprise,
        complianceReports: isEnterprise,
      },
    });
  } catch (error) {
    console.error('Subscription lookup error:', error);
    return res.status(500).json({ error: 'Failed to check subscription.' });
  }
});

// POST /create-promo — Create a promo code (Enterprise admin feature)
router.post('/create-promo', async (req: Request, res: Response) => {
  try {
    const { code, percentOff, maxRedemptions } = req.body;

    if (!code || !percentOff) {
      return res.status(400).json({ error: 'code and percentOff are required.' });
    }

    // Create a coupon
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration: 'repeating',
      duration_in_months: 3,
      max_redemptions: maxRedemptions || 100,
    });

    // Create a promotion code with the user-facing code string
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toUpperCase(),
      max_redemptions: maxRedemptions || 100,
    } as any);

    return res.status(200).json({
      success: true,
      promoCode: promoCode.code,
      percentOff,
      id: promoCode.id,
    });
  } catch (error: any) {
    console.error('Create promo error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create promo code.' });
  }
});

// POST /verify-session — Verify Stripe checkout session (fallback for localhost testing without webhooks)
router.post('/verify-session', async (req: Request, res: Response) => {
  try {
    const { sessionId, email } = req.body;

    if (!sessionId || !email) {
      return res.status(400).json({ error: 'sessionId and email are required.' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const plan = session.metadata?.plan || 'PRO';
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      let periodEnd: Date | null = null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId) as any;
        periodEnd = new Date(sub.current_period_end * 1000);
      }

      const subscription = await prisma.subscription.upsert({
        where: { email },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan,
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
        },
        create: {
          email,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan,
          status: 'ACTIVE',
          currentPeriodEnd: periodEnd,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Subscription verified and synchronized successfully.',
        subscription,
      });
    } else {
      return res.status(400).json({ error: 'Checkout session is not paid/complete.' });
    }
  } catch (error: any) {
    console.error('Session verification error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify session.' });
  }
});

// POST /grant-dev-license — Grant free developer Enterprise subscription
router.post('/grant-dev-license', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    if (email.trim().toLowerCase() !== 'ytannu1410@gmail.com') {
      return res.status(403).json({ error: 'Access Denied: Only the authorized developer email (ytannu1410@gmail.com) can bypass payments.' });
    }

    const tenYearsFromNow = new Date();
    tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

    const subscription = await prisma.subscription.upsert({
      where: { email },
      update: {
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        currentPeriodEnd: tenYearsFromNow,
        stripeCustomerId: 'DEV_BYPASS',
        stripeSubscriptionId: 'DEV_BYPASS_SUB',
      },
      create: {
        email,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        currentPeriodEnd: tenYearsFromNow,
        stripeCustomerId: 'DEV_BYPASS',
        stripeSubscriptionId: 'DEV_BYPASS_SUB',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Developer Enterprise license granted successfully.',
      subscription,
    });
  } catch (error: any) {
    console.error('Failed to grant dev license:', error);
    return res.status(500).json({ error: error.message || 'Failed to grant dev license.' });
  }
});

export default router;
