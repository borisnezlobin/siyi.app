import {
  HStack,
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

export type SiyiTodayWidgetProps = {
  appName: string;
  needAttention: number;
  comingUp: number;
  nextTitle: string;
  nextDetail: string;
  destination: string;
};

function SiyiTodayWidget(
  props: SiyiTodayWidgetProps,
  environment: WidgetEnvironment,
) {
  "widget";
  const isSmall = environment.widgetFamily === "systemSmall";

  return (
    <Link destination={props.destination}>
      <ZStack
        alignment="leading"
        modifiers={[
          containerBackground("#f4f7f4", "widget"),
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
          spacing={5}
        >
          <Text
            modifiers={[
              font({ size: 12, weight: "semibold" }),
              foregroundStyle("#c94f3b"),
            ]}
          >
            {props.appName}
          </Text>
          {isSmall ? (
            <>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 21, weight: "bold" }),
                  foregroundStyle("#17201c"),
                  lineLimit(2),
                ]}
              >
                {props.needAttention > 0
                  ? `${props.needAttention} need attention`
                  : "You’re caught up"}
              </Text>
              <Text
                modifiers={[
                  font({ size: 12 }),
                  foregroundStyle("#617069"),
                  lineLimit(2),
                ]}
              >
                {props.comingUp > 0
                  ? `${props.comingUp} coming up`
                  : "A good time to catch up"}
              </Text>
            </>
          ) : (
            <>
              <HStack spacing={20}>
                <VStack alignment="leading" spacing={0}>
                  <Text
                    modifiers={[
                      font({ size: 24, weight: "bold" }),
                      foregroundStyle("#17201c"),
                    ]}
                  >
                    {props.needAttention}
                  </Text>
                  <Text
                    modifiers={[
                      font({ size: 11 }),
                      foregroundStyle("#617069"),
                    ]}
                  >
                    need attention
                  </Text>
                </VStack>
                <VStack alignment="leading" spacing={0}>
                  <Text
                    modifiers={[
                      font({ size: 24, weight: "bold" }),
                      foregroundStyle("#17201c"),
                    ]}
                  >
                    {props.comingUp}
                  </Text>
                  <Text
                    modifiers={[
                      font({ size: 11 }),
                      foregroundStyle("#617069"),
                    ]}
                  >
                    coming up
                  </Text>
                </VStack>
              </HStack>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 14, weight: "semibold" }),
                  foregroundStyle("#17201c"),
                  lineLimit(1),
                ]}
              >
                {props.nextTitle}
              </Text>
              <Text
                modifiers={[
                  font({ size: 11 }),
                  foregroundStyle("#617069"),
                  lineLimit(1),
                ]}
              >
                {props.nextDetail}
              </Text>
            </>
          )}
        </VStack>
      </ZStack>
    </Link>
  );
}

export default createWidget("SiyiTodayWidget", SiyiTodayWidget);
