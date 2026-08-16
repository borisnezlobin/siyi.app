import type { ConfigContext, ExpoConfig } from "expo/config";

const appName = process.env.EXPO_PUBLIC_APP_NAME?.trim() || "Siyi.app";
const appSlug = process.env.EXPO_PUBLIC_APP_SLUG?.trim() || "siyi-app";
const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || "siyi";
const bundleIdentifier =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() ||
  "app.siyi.mobile";
const androidPackage =
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() ||
  "app.siyi.mobile";
const appDomain = process.env.EXPO_PUBLIC_APP_DOMAIN?.trim();
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
  "2a6e2096-32c9-46c1-af86-9391fa5b48fb";
const iosProtectedCapabilitiesEnabled =
  process.env.EXPO_PUBLIC_IOS_PROTECTED_CAPABILITIES !== "false";
const buildingForTheStore = process.env.EAS_BUILD_PROFILE === "production";

const createExpoConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "randomletters",
  name: appName,
  slug: appSlug,
  version: "1.0.0",
  orientation: "portrait",
  scheme: appScheme,
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  runtimeVersion: {
    policy: "appVersion",
  },
  ios: {
    bundleIdentifier,
    buildNumber: "1",
    // Left as one image, iOS makes its own grey of the light icon for tinted
    // mode, and the sage ground goes muddy. Rendered from the -source.svg
    // files beside them.
    icon: {
      light: "./assets/images/icon.png",
      dark: "./assets/images/icon-dark.png",
      tinted: "./assets/images/icon-tinted.png",
    },
    supportsTablet: false,
    usesAppleSignIn: iosProtectedCapabilitiesEnabled,
    associatedDomains: appDomain ? [`applinks:${appDomain}`] : undefined,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription:
        "Choose a profile photo for someone in your private circle.",
      NSCameraUsageDescription:
        "Take a profile photo for someone you want to remember.",
      // The app speaks to Supabase over https and nothing else. The Expo
      // template leaves this open, which is both untrue of the app and a
      // question the reviewer then has to be answered.
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
      },
      UIRequiredDeviceCapabilities: ["arm64"],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
      ],
    },
  },
  android: {
    package: androidPackage,
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#dfe9e2",
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/notification-icon.png",
    },
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: appDomain
      ? [
          {
            action: "VIEW",
            autoVerify: true,
            data: [{ scheme: "https", host: appDomain, pathPrefix: "/" }],
            category: ["BROWSABLE", "DEFAULT"],
          },
        ]
      : [],
  },
  web: {
    bundler: "metro",
    favicon: "./assets/images/icon.png",
  },
  plugins: [
    "expo-router",
    ...(iosProtectedCapabilitiesEnabled
      ? (["expo-apple-authentication"] as const)
      : []),
    // Nothing here is behind Face ID — SecureStore is used without
    // requireAuthentication — so the plugin's placeholder string would be
    // asking for a capability the app never exercises.
    ["expo-secure-store", { faceIDPermission: false }],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose a profile photo for someone in your private circle.",
        cameraPermission:
          "Take a profile photo for someone you want to remember.",
        // Profile photos only. Left unset, the plugin adds a microphone
        // string and Android RECORD_AUDIO for recording the app never does.
        microphonePermission: false,
      },
    ],
    ...(iosProtectedCapabilitiesEnabled
      ? ([
          [
            "expo-notifications",
            {
              icon: "./assets/images/notification-icon.png",
              color: "#e66b56",
              defaultChannel: "reminders",
            },
          ],
        ] as NonNullable<ExpoConfig["plugins"]>)
      : []),
    ...(iosProtectedCapabilitiesEnabled
      ? ["./plugins/with-iphone-only-widgets"]
      : []),
    ...(iosProtectedCapabilitiesEnabled
      ? ([
          [
            "expo-widgets",
            {
              bundleIdentifier: `${bundleIdentifier}.widgets`,
              groupIdentifier: `group.${bundleIdentifier}`,
              widgets: [
                {
                  name: "SiyiTodayWidget",
                  contentMarginsDisabled: true,
                  displayName: `${appName} Today`,
                  description:
                    "See reminders and what needs attention.",
                  supportedFamilies: ["systemSmall", "systemMedium"],
                },
                {
                  name: "SiyiCatchUpWidget",
                  contentMarginsDisabled: true,
                  displayName: `${appName} Catch Up`,
                  description:
                    "Bring someone to mind and open their context.",
                  supportedFamilies: ["systemSmall", "systemMedium"],
                },
              ],
            },
          ],
        ] as NonNullable<ExpoConfig["plugins"]>)
      : []),
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f4f7f4",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-web-browser",
      {
        experimentalLauncherActivity: false,
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission:
          "Allow Siyi to add the people you save to your contacts.",
      },
    ],
    ...(iosProtectedCapabilitiesEnabled
      ? []
      : ["./plugins/without-protected-ios-capabilities"]),
    ...(buildingForTheStore
      ? ["./plugins/without-dev-launcher-local-network"]
      : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: easProjectId,
    },
  },
});

export default createExpoConfig;
