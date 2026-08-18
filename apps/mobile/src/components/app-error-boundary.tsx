import { WarningCircle } from "phosphor-react-native";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { cardShadow, colors, radii } from "@/constants/theme";

/**
 * The app had no error boundary at all, so anything thrown while rendering
 * unmounted the whole tree: a white screen, no message, and no way back short
 * of force-quitting. React Native has no route-level boundary to fall back on
 * the way the web does, so this one wraps everything.
 *
 * Remounting by key is the only recovery worth offering. Most render throws
 * come from data that arrived in a shape the screen did not expect, and the
 * screens reload their data on focus, so building the tree again is usually
 * enough. If it is not, the same screen comes back rather than a white one,
 * which is at least somewhere to press.
 */
type Props = { children: ReactNode };
type State = { error: Error | null; attempt: number };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The only record this leaves. Without it the screen is a dead end for
    // whoever has to explain it as well as for whoever is looking at it.
    console.error("[siyi] render failed", error, info.componentStack);
  }

  render() {
    const { error, attempt } = this.state;
    if (!error) {
      return <View key={attempt} style={styles.fill}>{this.props.children}</View>;
    }

    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <WarningCircle color={colors.coralStrong} size={26} weight="fill" />
          </View>
          <AppText style={styles.title} variant="title">
            Something went wrong.
          </AppText>
          <AppText style={styles.body} variant="body">
            Nothing you saved has been lost. Anything waiting to sync is still
            on this phone.
          </AppText>
          <Button
            label="Try again"
            onPress={() =>
              this.setState((current) => ({
                error: null,
                attempt: current.attempt + 1,
              }))
            }
            style={styles.action}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.xlarge,
    maxWidth: 420,
    padding: 24,
    width: "100%",
    ...cardShadow,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.round,
    height: 52,
    justifyContent: "center",
    marginBottom: 16,
    width: 52,
  },
  title: { textAlign: "center" },
  body: {
    color: colors.inkMuted,
    marginTop: 10,
    textAlign: "center",
  },
  action: { marginTop: 24, width: "100%" },
});
