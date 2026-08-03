import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Use no more than 72 characters."),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    message: "The passwords do not match.",
    path: ["passwordConfirmation"],
  });

export async function PATCH(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
    const validation = passwordSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid password.");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: validation.data.password,
    });

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
