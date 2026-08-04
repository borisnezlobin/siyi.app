import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/load-state";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
    next?: string;
  }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finish() {
      const callbackError = params.error_description || params.error;
      if (callbackError) throw new Error(callbackError);
      if (!params.code) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          throw new Error(
            "This sign-in link is invalid or has expired. Request a fresh link and open it on this device.",
          );
        }
      } else {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) throw exchangeError;
      }

      if (!active) return;
      router.replace(
        params.next === "reset-password" ? "/reset-password" : "/",
      );
    }

    void finish().catch((callbackError) => {
      if (active) {
        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "The sign-in link could not be used.",
        );
      }
    });

    return () => {
      active = false;
    };
  }, [params.code, params.error, params.error_description, params.next, router]);

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => router.replace("/auth")}
      />
    );
  }
  return <LoadingState label="Finishing sign-in…" />;
}
