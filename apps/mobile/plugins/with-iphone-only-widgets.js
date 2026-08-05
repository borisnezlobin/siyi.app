/* eslint-disable @typescript-eslint/no-require-imports */
const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withIphoneOnlyWidgets(config) {
  return withXcodeProject(config, (projectConfig) => {
    const configurations =
      projectConfig.modResults.pbxXCBuildConfigurationSection();
    for (const configuration of Object.values(configurations)) {
      const settings = configuration?.buildSettings;
      if (
        typeof settings?.PRODUCT_BUNDLE_IDENTIFIER === "string" &&
        settings.PRODUCT_BUNDLE_IDENTIFIER.includes(".widgets")
      ) {
        settings.TARGETED_DEVICE_FAMILY = '"1"';
      }
    }
    return projectConfig;
  });
};
