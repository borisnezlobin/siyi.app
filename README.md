# Siyi.app

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
  `https://www.siyi.app/api/cron/notifications`
- `siyi_notification_cron_secret`: the same strong value used for
  `CRON_SECRET` by the web deployment
- `siyi_lifecycle_email_cron_url`:
  `https://www.siyi.app/api/cron/lifecycle-email`

The job and request history are available in Supabase Dashboard under
Integrations → Cron.

### Lifecycle email

Migration `0025` schedules a daily job that mails the nudges defined in
`src/lib/lifecycle-email.ts` — someone who has not saved a contact three days
in, someone quiet for a month. Three things have to be true before an account
is mailed: it opted in, its address is verified, and it has not had that
campaign before. `lifecycle_email_sends` records the last part, and the row is
written before the send so a retry cannot mail twice.

Unlike the auth email, these go through the Resend API directly, so the web
deployment needs `RESEND_API_KEY` and `MARKETING_FROM_EMAIL` of its own. Every
message carries `List-Unsubscribe` pointing at `/api/unsubscribe`, alongside the
visible link and the postal address the law asks for.

### Auth configuration

Under Authentication → URL Configuration, set the Site URL to `https://www.siyi.app`
and allow these redirect URLs:

```
https://www.siyi.app/auth/callback
https://www.siyi.app/auth/confirm
siyi://auth/callback
```

Confirm email must stay on under Authentication → Sign In / Providers → Email.
Supabase only links a Google identity to an account that already exists when
that account's address is verified; with confirmations off, signing in with
Google creates a second account for the same person. Any accounts left
unverified from before can be mailed a fresh confirmation with:

```
node scripts/send-pending-confirmations.mjs --dry-run   # who would be mailed
node scripts/send-pending-confirmations.mjs
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

Set `EXPO_PUBLIC_APP_DOMAIN` in the EAS production environment. Without it the
build simply has no `associatedDomains`, so shared links open in a browser
instead of the app, and nothing fails to tell you.

### Store listing

The files under `apps/mobile/store` are templates. Resolve them with:

```bash
npm run mobile:store:metadata            # writes apps/mobile/store/build
npm run mobile:store:metadata -- --check # verifies without writing
```

It fills the `${…}` markers from the environment or `apps/mobile/.env.local`,
refuses to write anything with a marker left in it, and checks the fields App
Store Connect limits. `EXPO_PUBLIC_LEGAL_ENTITY_NAME` is empty by default and
is what the copyright line and the legal pages name as the operator.

`review-notes.txt` carries the review account. It has to be a real account with
fictional people in it — the app is entirely behind a login, so review cannot
see anything without one.

Deploy the repository root to Vercel and configure the variables in
`.env.example`. Configure the Apple values after creating the Sign in with
Apple key; they are used for account-deletion token revocation and the
associated-domain file.
