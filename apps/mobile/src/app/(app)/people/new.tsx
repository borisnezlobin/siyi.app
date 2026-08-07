import { useEffect, useState } from "react";
import { PersonForm } from "@/components/person-form";
import { getAccountSettings } from "@/lib/data";
import { useAuth } from "@/providers/auth-provider";

export default function AddPersonScreen() {
  const { session } = useAuth();
  const [defaultUniversity, setDefaultUniversity] = useState("");

  // The form opens immediately; the default drops in behind it. Waiting on
  // settings to show an empty form would be a worse trade than a field that
  // fills itself a moment later.
  useEffect(() => {
    if (!session) return;
    let stillMounted = true;
    void getAccountSettings(session.user.id)
      .then((settings) => {
        if (stillMounted) setDefaultUniversity(settings.defaultUniversity);
      })
      .catch(() => undefined);
    return () => {
      stillMounted = false;
    };
  }, [session]);

  return <PersonForm defaultUniversity={defaultUniversity} />;
}
