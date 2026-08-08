import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { CollegeField } from "@/components/college-field";
import { DateField } from "@/components/date-field";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import {
  ownCardFieldKinds,
  ownCardFields,
  ownCardLabels,
  ownCardPlaceholders,
  type OwnCard,
  type OwnCardField,
} from "@/lib/own-card";
import {
  suggestUniversityFromEmail,
  universitySuggestionNote,
} from "@/lib/university-suggestion";

/**
 * What you hand out about yourself: the same details a person record holds,
 * entered the same way. Which entry each field wants is read from the shared
 * card definition rather than decided here, so a school autocompletes and a
 * birthday takes any spelling on the phone exactly as it does on the web.
 */
export function OwnCardFields({
  accountEmail = "",
  card,
  onChange,
}: {
  accountEmail?: string;
  card: OwnCard;
  onChange: (card: OwnCard) => void;
}) {
  const suggestion = useMemo(
    () => suggestUniversityFromEmail(accountEmail, card.university),
    [accountEmail, card.university],
  );

  function edit(field: OwnCardField, value: string) {
    onChange({ ...card, [field]: value });
  }

  return (
    <View style={styles.group}>
      {ownCardFields.map((field) => {
        const kind = ownCardFieldKinds[field];
        const label = ownCardLabels[field];
        const value = card[field] ?? "";

        if (kind === "university") {
          return (
            <View key={field} style={styles.group}>
              <CollegeField onChangeText={(next) => edit(field, next)} value={value} />
              {suggestion ? (
                <View style={styles.suggestion}>
                  <AppText style={styles.suggestionText} variant="caption">
                    {universitySuggestionNote(suggestion.domain)}: {suggestion.name}
                  </AppText>
                  <Button
                    compact
                    label="Use it"
                    onPress={() => edit(field, suggestion.name)}
                    variant="secondary"
                  />
                </View>
              ) : null}
            </View>
          );
        }

        if (kind === "date") {
          return (
            <DateField
              hint="Type it any way you like, or pick it from the calendar."
              key={field}
              label={label}
              onChangeText={(next) => edit(field, next)}
              value={value}
            />
          );
        }

        // Autocorrect helps where someone is writing words — a hometown, a
        // subject, a hall — and gets in the way everywhere else. A handle or an
        // address it "fixes" is simply wrong, and it mangles unusual names.
        const isHandle =
          field === "instagramUsername" || field === "discordUsername";
        const isName = field === "fullName" || field === "preferredName";
        const correctable = !isHandle && !isName && kind === "text";

        return (
          <FormField
            autoCapitalize={
              kind === "email" || isHandle
                ? "none"
                : isName
                  ? "words"
                  : "sentences"
            }
            autoCorrect={correctable}
            key={field}
            keyboardType={
              kind === "number"
                ? "number-pad"
                : kind === "email"
                  ? "email-address"
                  : kind === "phone"
                    ? "phone-pad"
                    : "default"
            }
            label={label}
            maxLength={kind === "number" ? 4 : 200}
            onChangeText={(next) => edit(field, next)}
            placeholder={ownCardPlaceholders[field]}
            value={value}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 14,
  },
  suggestion: {
    alignItems: "flex-start",
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    gap: 9,
    padding: 12,
  },
  suggestionText: {
    color: colors.inkMuted,
  },
});
