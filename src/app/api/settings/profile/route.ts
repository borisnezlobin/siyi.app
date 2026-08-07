import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  createHandleTag,
  handleProblem,
  handleProblemMessages,
  normalizeHandle,
} from "@/lib/handles";
import { ownCardFields } from "@/lib/own-card";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  handle: z.string().max(40).optional(),
  isPublic: z.boolean().optional(),
  publicFields: z.record(z.string(), z.boolean()).optional(),
});

/**
 * Claiming a handle and choosing what a stranger can see.
 *
 * The tag is minted here rather than chosen: it exists to stop a handle being
 * guessed from somebody's name, which it only does if it is random. A handle
 * already claimed keeps its tag, so somebody renaming themselves does not break
 * links they have already handed out — a rename does, which is why the response
 * always carries the address back.
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = profileSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Those settings are not valid.");

    const supabase = await createClient();
    const update: Record<string, unknown> = {};

    if (validation.data.handle !== undefined) {
      const handle = normalizeHandle(validation.data.handle);
      const problem = handleProblem(handle);
      if (problem) return apiError(handleProblemMessages[problem]);

      const { data: current } = await supabase
        .from("user_profiles")
        .select("handle,handle_tag")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      // The tag stays put once claimed: a rename should not break links people
      // already have.
      const tag =
        current?.handle_tag ??
        createHandleTag((size) => new Uint8Array(randomBytes(size)));

      update.handle = handle;
      update.handle_tag = tag;
    }

    if (validation.data.isPublic !== undefined) {
      update.profile_public = validation.data.isPublic;
    }

    if (validation.data.publicFields !== undefined) {
      // Only the fields a card can hold, and only ones switched on.
      const fields: Record<string, boolean> = {};
      for (const field of ownCardFields) {
        if (validation.data.publicFields[field] === true) fields[field] = true;
      }
      update.public_fields = fields;
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });

    const { error } = await supabase
      .from("user_profiles")
      .update(update)
      .eq("auth_user_id", user.id);

    if (error) {
      // The unique index is what actually decides a clash, so a duplicate is
      // reported from the failure rather than from a check that could race.
      if (error.code === "23505") {
        return apiError("Somebody already has that handle. Try another.");
      }
      return apiError(error.message, 400);
    }

    const { data: saved } = await supabase
      .from("user_profiles")
      .select("handle,handle_tag,profile_public,public_fields")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ profile: saved });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

