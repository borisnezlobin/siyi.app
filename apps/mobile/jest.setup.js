/**
 * Native modules every suite ends up reaching, mocked once here.
 *
 * Most of the app's modules lead to the offline store, and the offline store
 * leads to AsyncStorage — so a test of something unrelated could still fail at
 * import with "NativeModule: AsyncStorage is null". Six suites had learned to
 * mock it themselves and the other sixty-eight relied on never happening to
 * load it, which made whole-suite runs fail a few tests at random depending on
 * how work landed across workers. A flaky suite is worse than no suite: it
 * trains you to re-run instead of read.
 *
 * Suites that need to control these still mock them locally; a local mock wins.
 */
jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
    addEventListener: jest.fn(() => () => undefined),
  },
}));
