import { NextResponse, type NextRequest } from "next/server";
import { brand } from "@/config/brand";
import { apiError, errorMessage } from "@/lib/api";
import { getAdminUserFacts } from "@/lib/admin-data";
import { campaignForUser, renderLifecycleEmail } from "@/lib/lifecycle-email";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

/**
 * A cap per run, so a bug in a campaign predicate cannot mail the whole
 * database before anyone notices. The rest wait for the next run.
 */
const sendsPerRun = 50;

type SendRow = { user_id: string; campaign: string };

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError("Scheduled email is not configured.", 503);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return apiError("Unauthorized.", 401);
  }

  if (!isResendConfigured()) {
    return apiError("RESEND_API_KEY is not configured.", 503);
  }

  try {
    const admin = createAdminClient();
    const now = new Date();
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "https://siyi.app"
    ).replace(/\/$/, "");

    const [facts, { data: sendRows, error: sendsError }] = await Promise.all([
      getAdminUserFacts(),
      admin.from("lifecycle_email_sends").select("user_id,campaign"),
    ]);

    if (sendsError) return apiError(sendsError.message, 500);

    const sentByUser = new Map<string, Set<string>>();
    for (const row of (sendRows ?? []) as SendRow[]) {
      const campaigns = sentByUser.get(row.user_id) ?? new Set<string>();
      campaigns.add(row.campaign);
      sentByUser.set(row.user_id, campaigns);
    }

    const due = facts
      .map((userFacts) => ({
        userFacts,
        campaign: campaignForUser(
          userFacts,
          sentByUser.get(userFacts.userId) ?? [],
          now,
        ),
      }))
      .filter(
        (candidate): candidate is {
          userFacts: (typeof facts)[number];
          campaign: NonNullable<ReturnType<typeof campaignForUser>>;
        } => candidate.campaign !== null,
      )
      .slice(0, sendsPerRun);

    if (due.length === 0) {
      return NextResponse.json({
        evaluatedAt: now.toISOString(),
        sent: 0,
        skipped: 0,
        failed: 0,
      });
    }

    // Addresses are fetched only for the handful of accounts about to be
    // mailed, rather than pulled alongside every other statistic.
    const { data: recipients, error: recipientsError } = await admin
      .from("user_profiles")
      .select("auth_user_id,email")
      .in(
        "auth_user_id",
        due.map(({ userFacts }) => userFacts.userId),
      );

    if (recipientsError) return apiError(recipientsError.message, 500);

    const emailByUser = new Map(
      (recipients ?? []).map((row) => [
        row.auth_user_id as string,
        (row.email as string | null) ?? "",
      ]),
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const { userFacts, campaign } of due) {
      const address = emailByUser.get(userFacts.userId);
      if (!address) {
        skipped += 1;
        continue;
      }

      // The row is claimed before the send, so a second run cannot pick the
      // same person up while this one is still talking to Resend.
      const { error: claimError } = await admin
        .from("lifecycle_email_sends")
        .insert({ user_id: userFacts.userId, campaign: campaign.id });

      if (claimError) {
        if (claimError.code === "23505") skipped += 1;
        else failed += 1;
        continue;
      }

      const unsubscribeUrl = buildUnsubscribeUrl(userFacts.userId);
      const email = renderLifecycleEmail({
        campaign,
        appUrl,
        unsubscribeUrl,
        brandName: brand.name,
        postalAddress: brand.postalAddress,
      });

      try {
        await sendEmail({
          to: address,
          subject: email.subject,
          html: email.html,
          text: email.text,
          unsubscribeUrl,
        });
        sent += 1;
        await admin
          .from("lifecycle_email_sends")
          .update({ delivered_at: new Date().toISOString() })
          .eq("user_id", userFacts.userId)
          .eq("campaign", campaign.id);
      } catch (sendError) {
        failed += 1;
        // The claim stays, carrying why it failed: a send that Resend rejected
        // is not retried on the next tick without someone looking at it first.
        await admin
          .from("lifecycle_email_sends")
          .update({ failure_reason: errorMessage(sendError).slice(0, 500) })
          .eq("user_id", userFacts.userId)
          .eq("campaign", campaign.id);
      }
    }

    return NextResponse.json({
      evaluatedAt: now.toISOString(),
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
