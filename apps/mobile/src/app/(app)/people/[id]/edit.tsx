import { useLocalSearchParams } from "expo-router";
import { PersonForm } from "@/components/person-form";
import { ErrorState, LoadingState } from "@/components/load-state";
import { getPersonDetails, noteSectionsOf } from "@/lib/data";
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

  return (
    <PersonForm
      noteSections={noteSectionsOf(personData.data!)}
      person={personData.data!.person}
    />
  );
}
