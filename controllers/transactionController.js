const supabase = require('../supabaseClient');

// Check if Stripe secret key is available
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY environment variable is not set!');
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY );

exports.createTransaction = async (req, res) => {
  const { amount, user_id } = req.body;
  
  if (!amount) {
    return res.status(400).json({ error: 'Amount is required' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: "MoneyKaki Advisor TopUp",
              description: "Top up your advisor account with credits and points",
              images: ["https://moneykaki.vercel.app/assets/logo-Cb91Zvrb.png"]
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/payment-cancel?session_id={CHECKOUT_SESSION_ID}",
      payment_intent_data: {
        metadata: {
          user_id: user_id || 'unknown'
        }
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: "Checkout session failed" });
  }
};

// Stripe webhook handler
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        
        const user_id = paymentIntent.metadata.user_id;
        const amount = paymentIntent.amount / 100;
        
        console.log('Processing payment for user:', user_id, 'amount:', amount);
        
        if (user_id && user_id !== 'unknown') {
          try {
            const { data: user, error: userError } = await supabase
              .from('users')
              .select('credits')
              .eq('id', user_id)
              .single();

            if (userError) {
              console.error('Error fetching user:', userError);
            } else {

              const currentCredits = user.credits || 0;
              const newCredits = currentCredits + amount;

              const { error: updateError } = await supabase
                .from('users')
                .update({ 
                  credits: newCredits
                })
                .eq('id', user_id);

              if (updateError) {
                console.error('Error updating user credits:', updateError);
              } else {
                console.log(`Successfully updated user ${user_id} credits: ${currentCredits} + ${amount} = ${newCredits}`);
              }
            }
          } catch (dbError) {
            console.error('Database error in webhook:', dbError);
          }
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        break;

      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        break;

      default:
        console.log(`Unhandled event type ${event.type} at ${(new Date()).toISOString()}`);
    }

    res.json({ received: true, error: false });
  } catch (err) {
    console.error('Error handling webhook:', err);
    res.status(500).json({ received: true, error: true });
  }
};

