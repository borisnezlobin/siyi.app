# siyi.app

A private, mobile-first place to remember people, context, updates, and
follow-ups. The repository contains the Next.js web app/API and the Expo iPhone
app.

## Local development

Use Node 22 or newer, then install dependencies:

```bash
npm install
cp .env.example .env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

Start the web app with `npm run dev`. Start the native development client with
`npm run mobile:start:device`; install it on an attached iPhone first with
`npm run mobile:ios:device`.

Run the complete local verification suite with:

```bash
npm run check
```

## Supabase

Apply the migrations in `supabase/migrations` in order. Migration `0006`
enables Supabase Cron and schedules the notification evaluator hourly.

After the production web deployment exists, create these secrets in Supabase
Vault:

- `siyi_notification_cron_url`:
  `https://siyi.app/api/cron/notifications`
- `siyi_notification_cron_secret`: the same strong value used for
  `CRON_SECRET` by the web deployment

The job and request history are available in Supabase Dashboard under
Integrations → Cron.

## Production services

The EAS project is `@randomletters/siyi-app`. Production builds use the
`production` EAS environment and bundle identifier `app.siyi.mobile`.

Deploy the repository root to Vercel and configure the variables in
`.env.example`. Configure the Apple values after creating the Sign in with
Apple key; they are used for account-deletion token revocation and the
associated-domain file.
