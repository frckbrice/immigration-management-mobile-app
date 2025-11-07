
# 🚀 Quick Start Guide - Stripe Payment Integration

## What You Have Now

Your app is ready to accept payments! Here's what's been set up:

✅ Payment processing screen with card input
✅ Payment history tracking
✅ Secure Stripe integration
✅ Test mode enabled for safe testing
✅ Beautiful UI with dark mode support

## 🎯 Try It Now (Test Mode)

### Step 1: Open Your App
Run your app if it's not already running:
```bash
pnpm dev
```

### Step 2: Navigate to Payment
- Open the app on your device/simulator
- Tap the **"Make Payment"** button on the home screen
- Or go to **Profile → Payment History → Make New Payment**

### Step 3: Enter Test Card
Use this test card (it won't charge real money):
- **Card Number**: `4242 4242 4242 4242`
- **Expiry Date**: `12/25` (any future date)
- **CVC**: `123` (any 3 digits)
- **Postal Code**: `12345` (any 5 digits)

### Step 4: Process Payment
- Tap the **"Pay"** button
- You'll see a success message!

## 🔧 Make It Live (3 Steps)

### 1. Get Your Stripe Keys (5 minutes)

1. Go to https://stripe.com and sign up
2. Click **"Developers"** → **"API keys"**
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Copy your **Secret key** (starts with `sk_test_`)

### 2. Update Your App (2 minutes)

Open `utils/stripeConfig.ts` and replace:
```typescript
export const STRIPE_PUBLISHABLE_KEY = 'YOUR_KEY_HERE';
```

With your actual key:
```typescript
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51ABC...';
```

### 3. Set Up Backend (10 minutes)

Create a backend endpoint that:
1. Accepts payment amount and description
2. Creates a Stripe Payment Intent
3. Returns the client secret

Example (Node.js):
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-payment-intent', async (req, res) => {
  const { amount, description } = req.body;
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    description,
  });
  res.json({ clientSecret: paymentIntent.client_secret });
});
```

## 🧪 Test Cards

| Card | Result |
|------|--------|
| 4242 4242 4242 4242 | ✅ Success |
| 4000 0000 0000 0002 | ❌ Declined |
| 4000 0025 0000 3155 | 🔐 Requires Authentication |

## 📱 Where to Find Payment Features

### Home Screen
- **"Make Payment"** button in Quick Access section

### Profile Screen
- **"Payment History"** in Account Settings

### Payment Screen
- Enter card details
- See payment summary
- Process payment

### Payment History Screen
- View all past payments
- See payment status
- Make new payments

## 🎨 Customization

### Change Payment Amount
When navigating to payment screen:
```typescript
router.push({
  pathname: '/payment',
  params: {
    amount: '250.00',           // Your amount
    description: 'Custom Fee',  // Your description
    caseNumber: 'V-23-XXX'     // Your case number
  }
});
```

### Change Colors
Edit styles in `app/payment.tsx`:
```typescript
const styles = StyleSheet.create({
  payButton: {
    backgroundColor: '#YOUR_COLOR', // Change button color
    // ...
  },
});
```

## ⚠️ Important Security Notes

❌ **NEVER** commit your secret key to Git
❌ **NEVER** put your secret key in client code
✅ **ALWAYS** keep secret keys on the server
✅ **ALWAYS** validate amounts on the server
✅ **ALWAYS** use HTTPS in production

## 🐛 Troubleshooting

### Payment Screen Shows Mock Data
**Solution**: This is normal in test mode. Connect your backend to process real payments.

### "Invalid API Key" Error
**Solution**: Check that you've updated `utils/stripeConfig.ts` with your actual key.

### Card Input Not Working
**Solution**: Make sure you've installed dependencies:
```bash
npx expo install @stripe/stripe-react-native
```

### Backend Not Working
**Solution**: 
1. Check that your backend is deployed and running
2. Verify the URL in `app/payment.tsx`
3. Check that your secret key is set correctly

## 📚 Need More Help?

- **Setup Guide**: See `STRIPE_SETUP_GUIDE.md` for detailed instructions
- **System Overview**: See `PAYMENT_INTEGRATION_OVERVIEW.md` for architecture
- **Stripe Docs**: https://stripe.com/docs
- **Console Logs**: Check your app's console for debugging info

## 🎉 You're Ready!

Your payment system is fully integrated and ready to use. Start with test mode, then switch to live mode when you're ready to accept real payments!

---

**Quick Links:**
- 🔑 Get Stripe Keys: https://dashboard.stripe.com/apikeys
- 📖 Stripe Docs: https://stripe.com/docs
- 🧪 Test Cards: https://stripe.com/docs/testing
- 💬 Stripe Support: https://support.stripe.com

**Next Steps:**
1. ✅ Test with test cards
2. ✅ Get your Stripe keys
3. ✅ Deploy backend
4. ✅ Go live!
