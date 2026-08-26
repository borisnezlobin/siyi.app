const appleTeamIdPattern = /^[A-Z0-9]{10}$/;
const bundleIdentifierPattern = /^[A-Za-z0-9.-]+$/;

interface AppleAssociationEnvironment {
  [key: string]: string | undefined;
  APPLE_CLIENT_ID?: string;
  APPLE_TEAM_ID?: string;
}

/**
 * The signed app and this file must name the same Apple application identifier.
 * Returning an empty association is worse than failing: deployment looks healthy,
 * but every shared link quietly stays in Safari.
 */
export function appleAppSiteAssociation(
  environment: AppleAssociationEnvironment = process.env,
) {
  const teamId = environment.APPLE_TEAM_ID?.trim() ?? "";
  const bundleIdentifier = environment.APPLE_CLIENT_ID?.trim() ?? "";

  if (!appleTeamIdPattern.test(teamId)) {
    throw new Error("APPLE_TEAM_ID must be the 10-character Apple Team ID.");
  }
  if (!bundleIdentifierPattern.test(bundleIdentifier)) {
    throw new Error("APPLE_CLIENT_ID must be a valid bundle identifier.");
  }

  return {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [`${teamId}.${bundleIdentifier}`],
          components: [
            { "/": "/people*" },
            { "/": "/reminders*" },
            { "/": "/today*" },
            { "/": "/auth/callback*" },
          ],
        },
      ],
    },
  };
}
