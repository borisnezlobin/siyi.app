import type { ConfigContext, ExpoConfig } from "expo/config";

const appName = process.env.EXPO_PUBLIC_APP_NAME?.trim() || "Frenk";
const appSlug = process.env.EXPO_PUBLIC_APP_SLUG?.trim() || "frenk";
const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || "frenk";
const bundleIdentifier =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() ||
  "com.borisnezlobin.people";
const androidPackage =
  process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() ||
  "com.borisnezlobin.people";
const appDomain = process.env.EXPO_PUBLIC_APP_DOMAIN?.trim();

const createExpoConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
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
    supportsTablet: true,
    usesAppleSignIn: true,
    associatedDomains: appDomain ? [`applinks:${appDomain}`] : [],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription:
        "Choose a profile photo for someone in your private circle.",
      NSCameraUsageDescription:
        "Take a profile photo for someone you want to remember.",
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
      backgroundColor: "#17201c",
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
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose a profile photo for someone in your private circle.",
        cameraPermission:
          "Take a profile photo for someone you want to remember.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#e66b56",
        defaultChannel: "reminders",
      },
    ],
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
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim(),
    },
  },
});

export default createExpoConfig;
