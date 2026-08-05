import {
  Link,
  Spacer,
  Text,
  VStack,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

export type FrenkCatchUpWidgetProps = {
  name: string;
  context: string;
  destination: string;
};

function FrenkCatchUpWidget(
  props: FrenkCatchUpWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";
  const isSmall = environment.widgetFamily === "systemSmall";

  return (
    <Link destination={props.destination}>
      <ZStack
        alignment="leading"
        modifiers={[
          containerBackground("#17201c", "widget"),
          clipShape("containerRelativeShape"),
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
        ]}
      >
        <VStack
          alignment="leading"
          modifiers={[
            frame({
              maxWidth: Infinity,
              maxHeight: Infinity,
              alignment: "topLeading",
            }),
            padding({ all: 16 }),
          ]}
          spacing={6}
        >
          <Text
            modifiers={[
              font({ size: 12, weight: "semibold" }),
              foregroundStyle("#f3d680"),
            ]}
          >
            Catch up
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: isSmall ? 23 : 25, weight: "bold" }),
              foregroundStyle("#ffffff"),
              lineLimit(1),
            ]}
          >
            {props.name}
          </Text>
          <Text
            modifiers={[
              font({ size: isSmall ? 11 : 13 }),
              foregroundStyle("#dfe9e2"),
              lineLimit(isSmall ? 2 : 3),
            ]}
          >
            {props.context}
          </Text>
          {!isSmall ? (
            <Text
              modifiers={[
                font({ size: 11, weight: "semibold" }),
                foregroundStyle("#e66b56"),
              ]}
            >
              Open their context
            </Text>
          ) : null}
        </VStack>
      </ZStack>
    </Link>
  );
}

export default createWidget("FrenkCatchUpWidget", FrenkCatchUpWidget);
