import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import {
  KeyboardAwareForm,
  useFieldChain,
} from "@/components/keyboard-aware-form";
import { LoadingState } from "@/components/load-state";
import { colors } from "@/constants/theme";
import { updatePassword } from "@/lib/data";
import { useAuth } from "@/providers/auth-provider";

export default function ResetPasswordScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const fieldProps = useFieldChain(
    ["password", "confirmPassword"],
    () => void save(),
  );

  if (auth.loading) return <LoadingState />;
  if (!auth.session) return <Redirect href="/auth" />;

  async function save() {
    setPasswordError(password.length < 8 ? "Use at least 8 characters." : null);
    setConfirmError(
      password && password !== confirmPassword
        ? "This doesn’t match the password above."
        : null,
    );
    if (password.length < 8 || password !== confirmPassword) return;

    setSaving(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace("/");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your password could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAwareForm
      footer={
        <Button
          label="Save password"
          loading={saving}
          onPress={() => void save()}
        />
      }
      maxContentWidth={620}
    >
      <View style={styles.intro}>
        <AppText variant="display">Set a new password</AppText>
        <AppText style={styles.muted}>
          Choose something memorable and unique to this account.
        </AppText>
      </View>

      <FormField
        autoCapitalize="none"
        autoComplete="new-password"
        error={passwordError ?? undefined}
        label="New password"
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        value={password}
        {...fieldProps("password")}
      />
      <FormField
        autoCapitalize="none"
        autoComplete="new-password"
        error={confirmError ?? undefined}
        label="Confirm password"
        onChangeText={setConfirmPassword}
        secureTextEntry
        value={confirmPassword}
        {...fieldProps("confirmPassword")}
      />
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          style={styles.errorText}
          variant="caption"
        >
          {error}
        </AppText>
      ) : null}
    </KeyboardAwareForm>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: 8,
  },
  muted: {
    color: colors.inkMuted,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
