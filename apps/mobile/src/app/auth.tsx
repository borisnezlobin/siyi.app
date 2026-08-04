import { AppleLogo, Envelope, Eye, EyeSlash, GoogleLogo, LockKey, Sparkle } from "phosphor-react-native";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";
import { colors, fontFamilies, radii } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

type AuthMode = "sign-in" | "sign-up";

export default function AuthScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (auth.loading) return <LoadingState />;
  if (auth.session) {
    return (
      <Redirect
        href={
          auth.profile?.onboardingCompletedAt ? "/today" : "/onboarding"
        }
      />
    );
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setLoadingAction(label);
    setMessage(null);
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

  async function submitPassword() {
    if (!email.trim() || password.length < 8) {
      setError("Add your email and a password of at least 8 characters.");
      return;
    }
    if (mode === "sign-up" && !displayName.trim()) {
      setError("Add the name you would like us to use.");
      return;
    }

    await runAction("password", async () => {
      if (mode === "sign-in") {
        await auth.signInWithPassword(email, password);
      } else {
        const result = await auth.signUpWithPassword(
          email,
          password,
          displayName,
        );
        if (result === "confirmation-sent") {
          setMessage(
            "Check your email to confirm your account, then come back here.",
          );
        }
      }
    });
  }

  async function sendMagicLink() {
    if (!email.trim()) {
      setError("Add the email address where we should send the link.");
      return;
    }
    await runAction("magic", async () => {
      await auth.sendMagicLink(email);
      setMessage(
        "Your sign-in link is on its way. Open it on this device and in the same browser session.",
      );
    });
  }

  return (
    <Screen bottomInset={44} contentContainerStyle={styles.screen}>
      <View style={styles.brandRow}>
        <View style={styles.mark}>
          <AppText style={styles.markLetter} variant="title">
            {brand.name.slice(0, 1)}
          </AppText>
        </View>
        <AppText variant="heading">{brand.name}</AppText>
      </View>

      <View style={styles.hero}>
        <View style={styles.sparkle}>
          <Sparkle color={colors.coralStrong} size={20} weight="duotone" />
        </View>
        <AppText variant="display">Remember the people who matter.</AppText>
        <AppText style={styles.intro}>
          Keep names, context, and thoughtful follow-ups in one private place.
        </AppText>
      </View>

      <View style={styles.authCard}>
        <View style={styles.segmented}>
          {(["sign-in", "sign-up"] as const).map((option) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === option }}
              key={option}
              onPress={() => {
                setMode(option);
                setError(null);
                setMessage(null);
              }}
              style={[
                styles.segment,
                mode === option && styles.segmentSelected,
              ]}
            >
              <AppText
                style={
                  mode === option ? styles.segmentTextSelected : undefined
                }
                variant="label"
              >
                {option === "sign-in" ? "Sign in" : "Create account"}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.providerStack}>
          {Platform.OS === "ios" ? (
            <Button
              icon={AppleLogo}
              label="Continue with Apple"
              loading={loadingAction === "apple"}
              onPress={() =>
                void runAction("apple", auth.signInWithApple)
              }
              variant="dark"
            />
          ) : null}
          <Button
            icon={GoogleLogo}
            label="Continue with Google"
            loading={loadingAction === "google"}
            onPress={() =>
              void runAction("google", auth.signInWithGoogle)
            }
            variant="secondary"
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <AppText variant="caption">or use email</AppText>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          {mode === "sign-up" ? (
            <FormField
              autoCapitalize="words"
              autoComplete="name"
              label="Your name"
              onChangeText={setDisplayName}
              placeholder="How should we greet you?"
              textContentType="name"
              value={displayName}
            />
          ) : null}
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            textContentType="emailAddress"
            value={email}
          />
          <View style={styles.passwordGroup}>
            <AppText variant="label">Password</AppText>
            <View style={styles.passwordInput}>
              <LockKey color={colors.inkMuted} size={18} />
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={
                  mode === "sign-up" ? "new-password" : "current-password"
                }
                onChangeText={setPassword}
                onSubmitEditing={() => void submitPassword()}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.inkMuted}
                secureTextEntry={!showPassword}
                selectionColor={colors.coral}
                style={styles.passwordText}
                textContentType={
                  mode === "sign-up" ? "newPassword" : "password"
                }
                value={password}
              />
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
            </View>
          </View>
          <Button
            label={mode === "sign-in" ? "Sign in" : "Create account"}
            loading={loadingAction === "password"}
            onPress={() => void submitPassword()}
          />
          <Button
            icon={Envelope}
            label="Email me a sign-in link"
            loading={loadingAction === "magic"}
            onPress={() => void sendMagicLink()}
            variant="quiet"
          />
          {mode === "sign-in" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!email.trim()) {
                  setError("Add your email first, then try again.");
                  return;
                }
                void runAction("reset", async () => {
                  await auth.sendPasswordReset(email);
                  setMessage("We sent a password-reset link to your email.");
                });
              }}
            >
              <AppText style={styles.link} variant="caption">
                Forgot your password?
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {auth.configurationError || error ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText} variant="caption">
              {auth.configurationError || error}
            </AppText>
          </View>
        ) : null}
        {message ? (
          <View style={styles.successBox}>
            <AppText style={styles.successText} variant="caption">
              {message}
            </AppText>
          </View>
        ) : null}
      </View>

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
          Privacy Policy
        </AppText>
        .
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => void WebBrowser.openBrowserAsync(brand.webUrl)}
      >
        <AppText style={styles.websiteLink} variant="caption">
          Learn more about {brand.name}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: "center",
    maxWidth: 560,
    width: "100%",
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.medium,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  markLetter: {
    color: colors.paper,
    fontSize: 27,
    lineHeight: 30,
  },
  hero: {
    gap: 12,
  },
  sparkle: {
    alignItems: "center",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.round,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  intro: {
    color: colors.inkMuted,
    fontSize: 17,
    lineHeight: 25,
  },
  authCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.xlarge,
    gap: 20,
    padding: 18,
  },
  segmented: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    flexDirection: "row",
    padding: 4,
  },
  segment: {
    alignItems: "center",
    borderRadius: radii.round,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
  },
  segmentSelected: {
    backgroundColor: colors.ink,
  },
  segmentTextSelected: {
    color: colors.paper,
  },
  providerStack: {
    gap: 10,
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  dividerLine: {
    backgroundColor: colors.mist,
    flex: 1,
    height: 1,
  },
  form: {
    gap: 15,
  },
  passwordGroup: {
    gap: 7,
  },
  passwordInput: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  passwordText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 16,
  },
  eyeButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 34,
  },
  link: {
    color: colors.sageStrong,
    fontFamily: fontFamilies.bodySemibold,
    textDecorationLine: "underline",
  },
  errorBox: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 12,
  },
  errorText: {
    color: colors.coralStrong,
  },
  successBox: {
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    padding: 12,
  },
  successText: {
    color: colors.sageStrong,
  },
  legal: {
    color: colors.inkMuted,
    paddingHorizontal: 8,
    textAlign: "center",
  },
  websiteLink: {
    color: colors.sageStrong,
    textAlign: "center",
  },
});
