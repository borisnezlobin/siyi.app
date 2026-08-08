import { OwnCardSection } from "@/components/own-card-section";
import { Screen } from "@/components/screen";

/**
 * Kept so an existing link to /profile still lands somewhere sensible. The
 * card itself lives on the Settings page, where the web has it — this is the
 * same component, not a second copy.
 */
export default function ProfileScreen() {
  return (
    <Screen showBack title="Your card">
      <OwnCardSection />
    </Screen>
  );
}
