
# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing in your app.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Supabase project (for backend payment processing)
- Your app running with Expo

## Step 1: Get Your Stripe Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Click on "Developers" in the left sidebar
3. Click on "API keys"
4. You'll see two types of keys:
   - **Publishable key** (starts with `pk_test_` for test mode)
   - **Secret key** (starts with `sk_test_` for test mode)

⚠️ **Important**: Never commit your secret key to version control!

## Step 2: Configure Your App

1. Open `utils/stripeConfig.ts`
2. Replace the placeholder publishable key with your actual test publishable key:

```typescript
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_ACTUAL_KEY_HERE';
```

## Step 3: Set Up Backend (Supabase Edge Function)

### Option A: Using Supabase (Recommended)

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link Your Project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Find your project ref in your Supabase project settings)

4. **Set Your Stripe Secret Key**:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
   ```

5. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy create-payment-intent
   ```

6. **Update Payment Screen**:
   In `app/payment.tsx`, update the `createPaymentIntent` function to call your deployed edge function:

   ```typescript
   const createPaymentIntent = async (amount: number, description: string) => {
     const response = await fetch(
       'https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-payment-intent',
       {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer YOUR_SUPABASE_ANON_KEY`,
         },
         body: JSON.stringify({
           amount,
           description,
           metadata: {
             caseNumber: caseNumber,
           },
         }),
       }
     );
     return await response.json();
   };
   ```

### Option B: Using Your Own Backend

If you have your own backend, create an endpoint that:

1. Accepts payment details (amount, description, etc.)
2. Creates a Stripe Payment Intent using your secret key
3. Returns the client secret to your app

Example Node.js/Express endpoint:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-payment-intent', async (req, res) => {
  const { amount, description } = req.body;
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description,
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Step 4: Test Your Integration

### Test Card Numbers

Stripe provides test card numbers for testing:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

Use any future expiration date and any 3-digit CVC.

### Testing Flow

1. Navigate to the payment screen in your app
2. Enter the test card number: `4242 4242 4242 4242`
3. Enter any future date (e.g., 12/25)
4. Enter any 3-digit CVC (e.g., 123)
5. Enter any postal code (e.g., 12345)
6. Click "Pay"
7. You should see a success message

## Step 5: Monitor Payments

1. Go to your Stripe Dashboard
2. Click on "Payments" in the left sidebar
3. You'll see all test payments listed here
4. Click on any payment to see details

## Step 6: Going Live

When you're ready to accept real payments:

1. Complete your Stripe account activation
2. Switch from test keys to live keys:
   - In `utils/stripeConfig.ts`, use your live publishable key (`pk_live_...`)
   - In your backend, use your live secret key (`sk_live_...`)
3. Test thoroughly in production mode
4. Monitor your payments dashboard regularly

## Security Best Practices

- ✅ Never expose your secret key in client-side code
- ✅ Always validate payment amounts on the server
- ✅ Use HTTPS for all API calls
- ✅ Implement proper error handling
- ✅ Log payment attempts for debugging
- ✅ Set up webhook handlers for payment events
- ✅ Implement proper authentication before accepting payments

## Troubleshooting

### "Invalid API Key" Error
- Check that you're using the correct key format
- Ensure test keys start with `pk_test_` or `sk_test_`
- Verify you haven't accidentally swapped publishable and secret keys

### "Payment Failed" Error
- Check your internet connection
- Verify the backend is running and accessible
- Check Stripe Dashboard logs for detailed error messages

### "Card Declined" Error
- Use the correct test card numbers
- Ensure you're in test mode
- Check that the card details are complete

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe React Native SDK](https://github.com/stripe/stripe-react-native)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Testing Guide](https://stripe.com/docs/testing)

## Support

If you encounter issues:

1. Check the console logs in your app
2. Check the Stripe Dashboard logs
3. Review the Supabase function logs (if using Supabase)
4. Contact Stripe support for payment-specific issues
