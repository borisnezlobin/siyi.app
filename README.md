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

### Auth configuration

Under Authentication → URL Configuration, set the Site URL to `https://siyi.app`
and allow these redirect URLs:

```
https://siyi.app/auth/callback
https://siyi.app/auth/confirm
siyi://auth/callback
```

Sign in with Google and Sign in with Apple are configured under Authentication →
Providers. Google needs an OAuth client from the Google Cloud console; Apple
needs a Services ID and a Sign in with Apple key. Both use
`https://<project-ref>.supabase.co/auth/v1/callback` as the redirect URL. The
iPhone app signs in natively, so `app.siyi.mobile` also belongs in the Apple
provider's authorized client IDs.

### Transactional email

The built-in Supabase sender is rate limited to a couple of messages per hour
and is not meant for production. Resend delivers the auth emails instead. Verify
`siyi.app` in Resend, then fill in Authentication → Emails → SMTP Settings:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key (`RESEND_API_KEY`) |
| Sender email | an address on the verified domain, e.g. `noreply@siyi.app` |

The username is the literal string `resend` for every account; only the password
varies. A send-only API key is enough.

## Production services

The EAS project is `@randomletters/siyi-app`. Production builds use the
`production` EAS environment and bundle identifier `app.siyi.mobile`.

Deploy the repository root to Vercel and configure the variables in
`.env.example`. Configure the Apple values after creating the Sign in with
Apple key; they are used for account-deletion token revocation and the
associated-domain file.
