import * as Haptics from "expo-haptics";
import { Plus, Star, X } from "phosphor-react-native";
import { Pressable, StyleSheet, View, type TextInputProps } from "react-native";
import { AppText } from "@/components/app-text";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import {
  maxContactMethodLabelLength,
  maxContactMethodsPerKind,
  normalizeContactMethodValue,
  withPrimaryAt,
  withoutDraftAt,
  type ContactMethodDraft,
  type ContactMethodKind,
} from "@/lib/contact-methods";
import { formatPhoneNumberInput } from "@/lib/phone-format";

type KindPresentation = {
  heading: string;
  noun: string;
  placeholder: string;
  labelPlaceholder: string;
  inputProps: TextInputProps;
};

const presentation: Record<ContactMethodKind, KindPresentation> = {
  phone: {
    heading: "Phone",
    noun: "number",
    placeholder: "(555) 555-0123",
    labelPlaceholder: "work",
    inputProps: { autoComplete: "tel", keyboardType: "phone-pad" },
  },
  email: {
    heading: "Email",
    noun: "email",
    placeholder: "jordan@example.edu",
    labelPlaceholder: "school",
    inputProps: {
      autoCapitalize: "none",
      autoComplete: "email",
      keyboardType: "email-address",
    },
  },
  discord: {
    heading: "Discord",
    noun: "username",
    placeholder: "username",
    labelPlaceholder: "server",
    inputProps: { autoCapitalize: "none", autoCorrect: false },
  },
  instagram: {
    heading: "Instagram",
    noun: "handle",
    placeholder: "@username or profile link",
    labelPlaceholder: "finsta",
    inputProps: { autoCapitalize: "none", autoCorrect: false },
  },
};

/**
 * Every number, address or handle of one kind. With a single row this is the
 * plain field it has always been: no label box, nothing to choose between and
 * nothing to remove. The extra controls only appear from the second row.
 */
export function ContactMethodField({
  kind,
  drafts,
  onChange,
}: {
  kind: ContactMethodKind;
  drafts: ContactMethodDraft[];
  onChange: (drafts: ContactMethodDraft[]) => void;
}) {
  const { heading, noun, placeholder, labelPlaceholder, inputProps } =
    presentation[kind];
  const rows = drafts
    .map((draft, index) => ({ draft, index }))
    .filter((entry) => entry.draft.kind === kind);
  const showRowControls = rows.length > 1;

  function replaceAt(index: number, patch: Partial<ContactMethodDraft>) {
    onChange(
      drafts.map((draft, position) =>
        position === index ? { ...draft, ...patch } : draft,
      ),
    );
  }

  return (
    <View style={styles.group}>
      {rows.map(({ draft, index }, ordinal) => (
        <View key={`${kind}-${ordinal}`} style={styles.row}>
          <View style={styles.valueField}>
            <FormField
              {...inputProps}
              label={showRowControls ? `${heading} ${ordinal + 1}` : heading}
              onBlur={() => {
                if (kind !== "instagram") return;
                replaceAt(index, {
                  value: normalizeContactMethodValue(kind, draft.value),
                });
              }}
              onChangeText={(value) =>
                replaceAt(index, {
                  value: kind === "phone" ? formatPhoneNumberInput(value) : value,
                })
              }
              placeholder={placeholder}
              value={draft.value}
            />
          </View>

          {showRowControls ? (
            <View style={styles.rowControls}>
              <View style={styles.labelField}>
                <FormField
                  label="Label"
                  maxLength={maxContactMethodLabelLength}
                  onChangeText={(label) => replaceAt(index, { label })}
                  placeholder={labelPlaceholder}
                  value={draft.label ?? ""}
                />
              </View>
              <Pressable
                accessibilityLabel={
                  draft.isPrimary ? `Main ${noun}` : `Make this the main ${noun}`
                }
                accessibilityRole="button"
                accessibilityState={{ selected: draft.isPrimary }}
                onPress={() => {
                  onChange(withPrimaryAt(drafts, index));
                  void Haptics.selectionAsync();
                }}
                style={[
                  styles.rowButton,
                  draft.isPrimary && styles.rowButtonSelected,
                ]}
              >
                <Star
                  color={draft.isPrimary ? colors.ink : colors.inkMuted}
                  size={19}
                  weight={draft.isPrimary ? "fill" : "regular"}
                />
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove this ${noun}`}
                accessibilityRole="button"
                onPress={() => {
                  onChange(withoutDraftAt(drafts, index));
                  void Haptics.selectionAsync();
                }}
                style={styles.rowButton}
              >
                <X color={colors.coralStrong} size={18} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      {rows.length < maxContactMethodsPerKind ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onChange([
              ...drafts,
              { kind, value: "", label: null, isPrimary: rows.length === 0 },
            ]);
            void Haptics.selectionAsync();
          }}
          style={styles.addRow}
        >
          <Plus color={colors.coralStrong} size={14} weight="bold" />
          <AppText style={styles.addLabel} variant="caption">
            {rows.length === 0 ? `Add a ${noun}` : `Add another ${noun}`}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
  },
  row: {
    gap: 8,
  },
  valueField: {
    flex: 1,
  },
  rowControls: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  labelField: {
    flex: 1,
  },
  rowButton: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  rowButtonSelected: {
    backgroundColor: colors.sage,
  },
  addRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    minHeight: 32,
  },
  addLabel: {
    color: colors.coralStrong,
  },
});
