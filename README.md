# Orders for made-to-order sellers (Razorpay concept prototype)

A concept prototype for the Razorpay AI x PM Build Challenge, Track 1. Not the real Razorpay app.

The seller creates an order from a pasted chat or a photographed bill, the customer accepts it and pays by Razorpay payment link,
changes become versions the customer approves, and the app always asks for the correct amount due.

## Run locally
    npm install
    npm run dev        # http://localhost:3000, works with no keys (simulated checkout, simple rules, memory storage)

## Deploy on Vercel
1. Push this folder to a GitHub repo, then Vercel > Add New > Project > import it.
2. Storage tab > Create database > Neon (Postgres). It adds DATABASE_URL.
3. Settings > Environment Variables: add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (test keys), RAZORPAY_WEBHOOK_SECRET, ANTHROPIC_API_KEY, SESSION_SECRET.
4. Redeploy.
5. Razorpay dashboard (test mode) > Webhooks > add https://YOUR-APP.vercel.app/api/webhook/razorpay, event `payment_link.paid`, same secret as step 3.

More > "What is real in this prototype" shows which parts are live.

## Pages
- `/` Razorpay-style home with the new Orders entry points
- `/orders`, `/orders/new`, `/orders/[id]` seller flow
- `/c/[id]` customer page (no login)
- `/chat` chat simulator for the demo video's side screen
- `/more` owner/staff switch, language, status; `/metrics` success measures

## External services
Razorpay Payment Links API and webhooks (test mode), Anthropic API (reads chats and bills), Neon Postgres, Vercel.
