import { useLocalSearchParams } from "expo-router";
import { PersonForm } from "@/components/person-form";
import { ErrorState, LoadingState } from "@/components/load-state";
import { getPersonDetails } from "@/lib/data";
import { useRefreshableData } from "@/hooks/use-refreshable-data";

export default function EditPersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personData = useRefreshableData(() => getPersonDetails(id));

  if (personData.loading && !personData.data) {
    return <LoadingState label="Opening details…" />;
  }
  if (personData.error && !personData.data) {
    return (
      <ErrorState
        message={personData.error}
        onRetry={() => void personData.reload()}
      />
    );
  }

  return <PersonForm person={personData.data!.person} />;
}
