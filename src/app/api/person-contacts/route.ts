import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { saveContactMethods } from "@/app/api/people/contact-methods";
import {
  contactMethodKinds,
  legacyColumnsFromDrafts,
  type ContactMethodDraft,
} from "@/lib/contact-methods";

/**
 * Adding a phone or an email to the ones a person already has.
 *
 * The merge happens here rather than in the browser because saving contact
 * methods replaces the whole set: a caller that sent only the new one would
 * silently delete the rest. The current rows are read and written back in the
 * same breath, so the caller never has to hold them.
 */

const bodySchema = z.object({
  personId: z.string().uuid(),
  contacts: z
    .array(
      z.object({
        kind: z.enum(contactMethodKinds),
        value: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(8),
});

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const validation = bodySchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Those details are not valid.");
    }

    const { personId, contacts } = validation.data;

    const { data: person } = await supabase
      .from("people")
      .select("id")
      .eq("id", personId)
      .maybeSingle();
    if (!person) return apiError("That person could not be found.", 404);

    const { data: rows, error } = await supabase
      .from("person_contact_methods")
      .select("id, kind, value, label, is_primary, position")
      .eq("person_id", personId)
      .order("position", { ascending: true });
    if (error) return apiError(error.message, 400);

    const drafts: ContactMethodDraft[] = (rows ?? []).map((row) => ({
      id: row.id as string,
      kind: row.kind as ContactMethodDraft["kind"],
      value: row.value as string,
      label: (row.label as string | null) ?? null,
      isPrimary: Boolean(row.is_primary),
    }));

    for (const contact of contacts) {
      const held = drafts.filter((draft) => draft.kind === contact.kind);
      if (held.some((draft) => draft.value.toLowerCase() === contact.value.toLowerCase())) {
        continue;
      }
      drafts.push({
        kind: contact.kind,
        value: contact.value,
        label: null,
        // The first of its kind becomes the one the big buttons use; a second
        // sits underneath rather than taking over.
        isPrimary: held.length === 0,
      });
    }

    const saved = await saveContactMethods(supabase, user.id, personId, drafts);
    if (saved.error) return apiError(saved.error, 400);
    if (!saved.available) return apiError("Contact details are not available yet.", 400);

    // The single columns stay the primary of each kind, because export, search
    // and the phone all still read them.
    const primaries = legacyColumnsFromDrafts(drafts);
    await supabase
      .from("people")
      .update({
        phone_number: primaries.phoneNumber,
        email: primaries.email,
        instagram_username: primaries.instagramUsername,
      })
      .eq("id", personId);

    return NextResponse.json({ contactMethods: drafts });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
