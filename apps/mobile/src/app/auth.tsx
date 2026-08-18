import {
  CheckSquare,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Square,
} from "phosphor-react-native";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { ProviderButton } from "@/components/provider-button";
import {
  KeyboardAwareForm,
  useFieldChain,
} from "@/components/keyboard-aware-form";
import { LoadingState } from "@/components/load-state";
import { brand } from "@/config/brand";
import { cardShadow, colors, fontFamilies, radii } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

type AuthMode = "sign-in" | "sign-up";
/** Password and emailed link are separate ways in, never both at once. */
type EmailMethod = "password" | "link";

type SentLink = { kind: "confirm" | "reset" | "sign-in"; email: string };

type FieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
};

export default function AuthScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [method, setMethod] = useState<EmailMethod>("password");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  // A one-line status under a still-filled form read as a failure, so a sent
  // link takes over the whole screen instead.
  const [sent, setSent] = useState<SentLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const usingPassword = method === "password";
  const fieldProps = useFieldChain(
    [
      ...(usingPassword && mode === "sign-up" ? ["displayName"] : []),
      "email",
      ...(usingPassword ? ["password"] : []),
    ],
    () => void submit(),
  );

  if (auth.loading) return <LoadingState />;
  if (auth.session) {
    return (
      <Redirect
        href={auth.profile?.onboardingCompletedAt ? "/today" : "/onboarding"}
      />
    );
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setLoadingAction(label);
    setSent(null);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Sign-in could not be completed.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  function missingFields(): FieldErrors {
    const missing: FieldErrors = {};
    if (!email.trim()) missing.email = "Add your email address.";
    if (usingPassword) {
      if (!password) {
        missing.password = "Add your password.";
      } else if (password.length < 8) {
        missing.password = "Use at least 8 characters.";
      }
      if (mode === "sign-up" && !displayName.trim()) {
        missing.displayName = "Add the name we should call you.";
      }
    }
    return missing;
  }

  async function submit() {
    const missing = missingFields();
    setFieldErrors(missing);
    if (Object.keys(missing).length > 0) {
      setSent(null);
      setError(null);
      return;
    }

    if (!usingPassword) {
      await runAction("magic", async () => {
        await auth.sendMagicLink(email);
        setSent({ kind: "sign-in", email: email.trim() });
      });
      return;
    }

    await runAction("password", async () => {
      if (mode === "sign-in") {
        await auth.signInWithPassword(email, password);
        return;
      }
      const result = await auth.signUpWithPassword(
        email,
        password,
        displayName,
        marketingOptIn,
      );
      if (result === "confirmation-sent") {
        setSent({ kind: "confirm", email: email.trim() });
      }
    });
  }

  function switchMethod(next: EmailMethod) {
    setMethod(next);
    setFieldErrors({});
    setError(null);
    setSent(null);
  }

  if (sent) {
    const linkKind =
      sent.kind === "confirm"
        ? "confirmation"
        : sent.kind === "reset"
          ? "password-reset"
          : "sign-in";
    const nextStep =
      sent.kind === "confirm"
        ? `Open it to confirm your account and finish setting up ${brand.shortName}.`
        : sent.kind === "reset"
          ? "Open it to choose a new password."
          : "Open it on this phone and you are signed in.";

    return (
      <KeyboardAwareForm
        bottomInset={40}
        contentStyle={styles.sentScreen}
        footer={
          <Button
            label="Back to sign in"
            onPress={() => setSent(null)}
            variant="quiet"
          />
        }
        maxContentWidth={520}
      >
        <View style={styles.sentCard}>
          <View style={styles.sentIcon}>
            <EnvelopeSimple color={colors.paper} size={26} weight="bold" />
          </View>
          <AppText variant="display">Check your email</AppText>
          <AppText style={styles.sentBody}>
            {`Your ${linkKind} link is on its way to ${sent.email}. ${nextStep}`}
          </AppText>
          <AppText style={styles.sentBody} variant="caption">
            It usually lands within a minute. If it has not shown up, have a
            look in your spam folder.
          </AppText>
        </View>
      </KeyboardAwareForm>
    );
  }

  const primaryLabel = !usingPassword
    ? "Email me a sign-in link"
    : mode === "sign-in"
      ? "Sign in"
      : "Create account";

  return (
    <KeyboardAwareForm
      bottomInset={40}
      contentStyle={styles.stack}
      // Pinned rather than sitting under the password field: the keyboard
      // covers everything below whatever you are typing in.
      footer={
        <Button
          label={primaryLabel}
          loading={loadingAction === (usingPassword ? "password" : "magic")}
          onPress={() => void submit()}
        />
      }
      maxContentWidth={520}
    >
      <AppText variant="display">Remember the people who matter.</AppText>

      {usingPassword ? (
        <View style={styles.modeRow}>
          {(["sign-in", "sign-up"] as const).map((option) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === option }}
              key={option}
              onPress={() => {
                setMode(option);
                setFieldErrors({});
                setError(null);
                setSent(null);
              }}
              style={styles.modeTab}
            >
              <AppText
                style={mode === option ? styles.modeSelected : styles.modeIdle}
                variant="label"
              >
                {option === "sign-in" ? "Sign in" : "Create account"}
              </AppText>
              <View
                style={[
                  styles.modeUnderline,
                  mode === option && styles.modeUnderlineSelected,
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText style={styles.muted}>
          Enter your email and we&apos;ll send a link that signs you in. No
          password needed.
        </AppText>
      )}

      <View style={styles.form}>
        {usingPassword && mode === "sign-up" ? (
          <FormField
            autoCapitalize="words"
            autoComplete="name"
            error={fieldErrors.displayName}
            label="Your name"
            onChangeText={setDisplayName}
            placeholder="What should we call you?"
            textContentType="name"
            value={displayName}
            {...fieldProps("displayName")}
          />
        ) : null}
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          error={fieldErrors.email}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          textContentType="emailAddress"
          value={email}
          {...fieldProps("email")}
        />
        {usingPassword ? (
          <FormField
            accessory={
              <Pressable
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                accessibilityRole="button"
                onPress={() => setShowPassword((visible) => !visible)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeSlash color={colors.inkMuted} size={19} />
                ) : (
                  <Eye color={colors.inkMuted} size={19} />
                )}
              </Pressable>
            }
            autoCapitalize="none"
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
            error={fieldErrors.password}
            label="Password"
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            textContentType={mode === "sign-up" ? "newPassword" : "password"}
            value={password}
            {...fieldProps("password")}
          />
        ) : null}

        {usingPassword && mode === "sign-up" ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marketingOptIn }}
            onPress={() => setMarketingOptIn((consented) => !consented)}
            style={styles.consentRow}
          >
            {marketingOptIn ? (
              <CheckSquare color={colors.coral} size={22} weight="fill" />
            ) : (
              <Square color={colors.inkMuted} size={22} />
            )}
            <AppText style={styles.consentText} variant="caption">
              Email me occasional news about {brand.shortName}. We only send
              things worth reading, and very rarely.
            </AppText>
          </Pressable>
        ) : null}

        {usingPassword && mode === "sign-in" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!email.trim()) {
                setFieldErrors({ email: "Add your email address." });
                return;
              }
              void runAction("reset", async () => {
                await auth.sendPasswordReset(email);
                setSent({ kind: "reset", email: email.trim() });
              });
            }}
            style={styles.inlineLink}
          >
            <AppText style={styles.link} variant="caption">
              Forgot your password?
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {auth.configurationError || error ? (
        <AppText
          accessibilityLiveRegion="polite"
          style={styles.errorText}
          variant="caption"
        >
          {auth.configurationError || error}
        </AppText>
      ) : null}

      <View style={styles.providers}>
        <ProviderButton disabled label="Continue with Apple" provider="apple" />
        <ProviderButton
          label="Continue with Google"
          loading={loadingAction === "google"}
          onPress={() =>
            void runAction("google", async () => {
              await auth.signInWithGoogle();
            })
          }
          provider="google"
        />
        <AppText style={styles.providerNote} variant="caption">
          Apple sign-in is coming soon.
        </AppText>
      </View>

      <Button
        label={
          usingPassword ? "Email me a sign-in link" : "Use my password instead"
        }
        onPress={() => switchMethod(usingPassword ? "link" : "password")}
        variant="quiet"
      />

      <AppText style={styles.legal} variant="caption">
        By continuing, you agree to our{" "}
        <AppText
          onPress={() => router.push("/legal/terms")}
          style={styles.link}
          variant="caption"
        >
          Terms
        </AppText>{" "}
        and acknowledge our{" "}
        <AppText
          onPress={() => router.push("/legal/privacy")}
          style={styles.link}
          variant="caption"
        >
          Privacy policy
        </AppText>
        .
      </AppText>
    </KeyboardAwareForm>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24,
  },
  muted: {
    color: colors.inkMuted,
  },
  modeRow: {
    flexDirection: "row",
    gap: 22,
  },
  modeTab: {
    gap: 8,
  },
  modeIdle: {
    color: colors.inkMuted,
  },
  modeSelected: {
    color: colors.ink,
  },
  modeUnderline: {
    backgroundColor: colors.transparent,
    height: 2,
  },
  modeUnderlineSelected: {
    backgroundColor: colors.ink,
  },
  form: {
    gap: 16,
  },
  eyeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 40,
  },
  inlineLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  link: {
    color: colors.sageStrong,
    fontFamily: fontFamilies.bodySemibold,
  },
  errorText: {
    color: colors.coralStrong,
  },
  sentScreen: {
    flexGrow: 1,
    justifyContent: "center",
  },
  sentCard: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 12,
    paddingHorizontal: 26,
    paddingVertical: 32,
    ...cardShadow,
  },
  sentIcon: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: 4,
    width: 56,
  },
  sentBody: {
    color: colors.inkMuted,
    textAlign: "center",
  },
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  consentText: {
    color: colors.inkMuted,
    flex: 1,
  },
  providers: {
    gap: 10,
  },
  providerNote: {
    color: colors.inkMuted,
    textAlign: "center",
  },
  legal: {
    color: colors.inkMuted,
    textAlign: "center",
  },
});
