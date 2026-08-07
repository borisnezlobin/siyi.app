import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { contactDraftsOf } from "@/lib/contact-methods";
import { isValidShareToken } from "@/lib/person-share";
import { resolveSharedPerson } from "@/lib/person-share-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves a shared card into the viewer's own circle.
 *
 * The payload is rebuilt here from the sharer's stored field selection rather
 * than taken from the request, so a caller cannot widen what the link exposed by
 * posting extra fields.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { token } = await params;
    if (!isValidShareToken(token)) return apiError("That link is not valid.", 404);

    const shared = await resolveSharedPerson(token);
    if (!shared) return apiError("That link is no longer available.", 404);

    const { person, selection } = shared;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("user_id", user.id)
      .eq("full_name", person.fullName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ person: existing, alreadySaved: true });
    }

    const { data, error } = await supabase
      .from("people")
      .insert({
        user_id: user.id,
        full_name: person.fullName,
        preferred_name: selection.preferredName ? person.preferredName : null,
        phone_number: selection.phoneNumber ? person.phoneNumber : null,
        email: selection.email ? person.email : null,
        instagram_username: selection.instagram ? person.instagramUsername : null,
        birthday: selection.birthday ? person.birthday : null,
        hometown: selection.hometown ? person.hometown : null,
        university: selection.university ? person.university : null,
        major: selection.major ? person.major : null,

        relationship_strength: 2,
        status: "active",
        first_met_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return apiError(error.message, 400);

    const methods = contactDraftsOf(person).filter((method) => {
      if (method.kind === "phone") return selection.phoneNumber;
      if (method.kind === "email") return selection.email;
      if (method.kind === "instagram") return selection.instagram;
      return false;
    });

    if (methods.length > 0) {
      // Older databases have no contact-method table yet; the columns above
      // already carry the primary of each kind, so this is best effort.
      await supabase.from("person_contact_methods").insert(
        methods.map((method, position) => ({
          user_id: user.id,
          person_id: data.id,
          kind: method.kind,
          value: method.value,
          label: method.label,
          is_primary: method.isPrimary,
          position,
        })),
      );
    }

    return NextResponse.json({ person: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
