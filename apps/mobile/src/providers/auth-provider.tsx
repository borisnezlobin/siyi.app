import type { Session } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { brand } from "@/config/brand";
import {
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";
import type { UserProfile } from "@/lib/types";
import {
  getOfflineSnapshot,
  isOnline,
  updateOfflineSnapshot,
} from "@/lib/offline-store";

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  configurationError: string | null;
  refreshProfile: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<"signed-in" | "confirmation-sent">;
  sendMagicLink: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  timezone: string;
  locale: string;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    locale: row.locale,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mobileRedirect(path = "auth/callback") {
  return makeRedirectUri({
    scheme: brand.scheme,
    path,
    native: `${brand.scheme}://${path}`,
  });
}

async function finishOAuthRedirect(url: string) {
  const parsedUrl = new URL(url);
  const error =
    parsedUrl.searchParams.get("error_description") ||
    parsedUrl.searchParams.get("error");
  if (error) throw new Error(error);

  const code = parsedUrl.searchParams.get("code");
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  const fragment = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("The sign-in response did not include a session.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      setProfile(null);
      return;
    }

    const snapshot = await getOfflineSnapshot(activeSession.user.id);
    if (!(await isOnline())) {
      if (snapshot.profile) {
        setProfile(snapshot.profile);
        return;
      }
      throw new Error("Connect once to finish loading this account.");
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", activeSession.user.id)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const mappedProfile = mapProfile(data as ProfileRow);
      setProfile(mappedProfile);
      await updateOfflineSnapshot(activeSession.user.id, (current) => ({
        ...current,
        profile: mappedProfile,
      }));
      return;
    }

    const { data: createdProfile, error: createError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          auth_user_id: activeSession.user.id,
          display_name:
            activeSession.user.user_metadata.full_name ||
            activeSession.user.user_metadata.name ||
            "",
          email: activeSession.user.email || "",
        },
        { onConflict: "auth_user_id" },
      )
      .select()
      .single();

    if (createError) throw createError;
    const mappedProfile = mapProfile(createdProfile as ProfileRow);
    setProfile(mappedProfile);
    await updateOfflineSnapshot(activeSession.user.id, (current) => ({
      ...current,
      profile: mappedProfile,
    }));
  }, []);

  const refreshProfile = useCallback(
    async () => loadProfile(session),
    [loadProfile, session],
  );

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try {
        await loadProfile(data.session);
      } catch {
        if (data.session) {
          const snapshot = await getOfflineSnapshot(data.session.user.id);
          if (snapshot.profile) setProfile(snapshot.profile);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setTimeout(() => {
        void loadProfile(nextSession)
          .catch(async () => {
            if (!nextSession) return;
            const snapshot = await getOfflineSnapshot(nextSession.user.id);
            if (snapshot.profile && mounted) setProfile(snapshot.profile);
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signInWithApple() {
    if (Platform.OS !== "ios") {
      throw new Error("Apple sign-in is available in the iPhone app.");
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
      access_token: credential.authorizationCode || undefined,
    });
    if (error) throw error;

    const fullName = credential.fullName
      ? AppleAuthentication.formatFullName(credential.fullName).trim()
      : "";
    if (fullName && data.user) {
      await Promise.all([
        supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName?.givenName,
            family_name: credential.fullName?.familyName,
          },
        }),
        supabase
          .from("user_profiles")
          .update({ display_name: fullName })
          .eq("auth_user_id", data.user.id)
          .eq("display_name", ""),
      ]);
    }
  }

  async function signInWithGoogle() {
    const redirectTo = mobileRedirect();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error("Google sign-in could not be started.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "cancel" || result.type === "dismiss") return;
    if (result.type !== "success") {
      throw new Error("Google sign-in did not finish.");
    }
    await finishOAuthRedirect(result.url);
  }

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }

  async function signUpWithPassword(
    email: string,
    password: string,
    displayName: string,
  ) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: mobileRedirect(),
        data: {
          full_name: displayName.trim(),
          app_name: brand.name,
        },
      },
    });
    if (error) throw error;
    return data.session ? "signed-in" : "confirmation-sent";
  }

  async function sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: mobileRedirect(),
        data: { app_name: brand.name },
      },
    });
    if (error) throw error;
  }

  async function sendPasswordReset(email: string) {
    const redirectTo = `${mobileRedirect()}?next=reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      configurationError: isSupabaseConfigured
        ? null
        : "Add the Expo Supabase variables before signing in.",
      refreshProfile,
      signInWithApple,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      sendMagicLink,
      sendPasswordReset,
      signOut,
    }),
    [loading, profile, refreshProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
