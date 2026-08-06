import {
  MAP_HEIGHT,
  MAP_WIDTH,
  countryOutlines,
  projectToMap,
} from "@/lib/world-outline";
import type { HometownPlace } from "@/lib/geocode";

/** Wider than tall, so the map reads as a strip rather than a poster. */
const mapAspectRatio = 2.4;

/** Never zoom in past roughly a quarter of the world. */
const minimumSpan = MAP_WIDTH / 4;

/**
 * Frames the pins rather than always showing the whole globe: a circle that
 * happens to be entirely Californian gets a map of California. The frame is
 * clamped to the world and never zooms past `minimumSpan`, so a single pin
 * still has enough coastline around it to be recognisable.
 */
function fitViewBox(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    const height = MAP_WIDTH / mapAspectRatio;
    return `0 ${(MAP_HEIGHT - height) / 2} ${MAP_WIDTH} ${height}`;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = 0.25;
  const spanX = (Math.max(...xs) - Math.min(...xs)) * (1 + padding);
  const spanY = (Math.max(...ys) - Math.min(...ys)) * (1 + padding);

  let width = Math.max(spanX, spanY * mapAspectRatio, minimumSpan);
  width = Math.min(width, MAP_WIDTH);
  let height = width / mapAspectRatio;
  if (height > MAP_HEIGHT) {
    height = MAP_HEIGHT;
    width = height * mapAspectRatio;
  }

  const centreX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centreY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const clamp = (value: number, limit: number) =>
    Math.max(0, Math.min(value, limit));

  return [
    clamp(centreX - width / 2, MAP_WIDTH - width),
    clamp(centreY - height / 2, MAP_HEIGHT - height),
    width,
    height,
  ]
    .map((value) => Math.round(value))
    .join(" ");
}

/**
 * The SVG stretches its viewBox to the container, so a pin has to be sized as a
 * fraction of the frame to come out the same size on screen whether we are
 * showing the whole world or one state. 560 is roughly the rendered width in
 * CSS pixels, splitting the difference between a phone and a desktop, which
 * makes `unit` about one pixel on either.
 */
function pixelUnit(viewWidth: number) {
  return viewWidth / 560;
}

function pinRadius(count: number, unit: number) {
  return (7 + Math.sqrt(count - 1) * 5) * unit;
}

/**
 * The map is a picture of the list underneath it, not a replacement for it, so
 * it is hidden from screen readers rather than described badly.
 */
export function HometownMap({ places }: { places: HometownPlace[] }) {
  const projected = places.map((place) => ({
    ...place,
    ...projectToMap(place.latitude, place.longitude),
  }));
  const viewBox = fitViewBox(projected);
  const unit = pixelUnit(Number(viewBox.split(" ")[2]));

  return (
    <div className="overflow-hidden rounded-3xl bg-paper shadow-card">
      <svg
        viewBox={viewBox}
        className="block h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <g
          className="fill-sage stroke-white"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        >
          {countryOutlines.map((outline, index) => (
            <path key={index} d={outline} />
          ))}
        </g>
        {projected.map((place) => (
          // Not in the tab order: the list below is the real, navigable copy of
          // this, and duplicating every pin into it would only be noise.
          <a key={place.key} href={`#place-${place.key}`} tabIndex={-1}>
            <circle
              cx={place.x}
              cy={place.y}
              r={pinRadius(place.people.length, unit)}
              className={
                place.precision === "city"
                  ? "fill-coral stroke-white transition-opacity hover:opacity-75"
                  : "fill-white stroke-coral transition-opacity hover:opacity-75"
              }
              strokeWidth={(place.precision === "city" ? 2.5 : 3) * unit}
            />
          </a>
        ))}
      </svg>
    </div>
  );
}
