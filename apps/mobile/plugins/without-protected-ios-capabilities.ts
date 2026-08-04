import {
  withEntitlementsPlist,
  type ConfigPlugin,
} from "expo/config-plugins";

const withoutProtectedIosCapabilities: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (entitlementsConfig) => {
    delete entitlementsConfig.modResults["aps-environment"];
    delete entitlementsConfig.modResults["com.apple.developer.applesignin"];
    return entitlementsConfig;
  });

export default withoutProtectedIosCapabilities;
