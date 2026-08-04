import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { Card } from "@/components/surface";
import { colors, radii } from "@/constants/theme";
import { updatePassword } from "@/lib/data";
import { useAuth } from "@/providers/auth-provider";

export default function ResetPasswordScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.loading) return <LoadingState />;
  if (!auth.session) return <Redirect href="/auth" />;

  async function save() {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }
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
    <Screen
      bottomInset={40}
      subtitle="Choose something memorable and unique to this account."
      title="Set a new password"
    >
      <Card style={styles.card}>
        <FormField
          autoCapitalize="none"
          label="New password"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        <FormField
          autoCapitalize="none"
          label="Confirm password"
          onChangeText={setConfirmPassword}
          secureTextEntry
          value={confirmPassword}
        />
        {error ? (
          <View style={styles.error}>
            <AppText style={styles.errorText} variant="caption">
              {error}
            </AppText>
          </View>
        ) : null}
        <Button
          label="Save password"
          loading={saving}
          onPress={() => void save()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 12,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
