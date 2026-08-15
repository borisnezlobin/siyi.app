import { withInfoPlist, type ConfigPlugin } from "expo/config-plugins";

/**
 * expo-dev-client is a development dependency, but EAS installs development
 * dependencies too, so its plugin still runs on a store build and leaves
 * behind a local-network permission whose own copy says it is there to find
 * "development servers running on your computer". A reviewer reads that
 * prompt, and a shipped app has no business asking the question at all.
 *
 * Only the production profile is stripped: a development or preview build is
 * exactly where the dev launcher should keep working.
 */
const withoutDevLauncherLocalNetwork: ConfigPlugin = (config) =>
  withInfoPlist(config, (infoPlistConfig) => {
    delete infoPlistConfig.modResults.NSLocalNetworkUsageDescription;
    delete infoPlistConfig.modResults.NSBonjourServices;
    return infoPlistConfig;
  });

export default withoutDevLauncherLocalNetwork;
