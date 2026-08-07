import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

type OgPage = { title: string; description?: string };

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PEOPLE_GLYPH =
  "M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z";

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="242" y="242" width="540" height="540" rx="88" ry="88" fill="#2f6249" transform="rotate(15 512 512)"/>
  <circle cx="512" cy="512" r="238" fill="#e66b56"/>
  <g transform="translate(512 512) scale(1.07) translate(-128 -136)" fill="#ffffff"><path d="${PEOPLE_GLYPH}"/></g>
</svg>`;

const markDataUri = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;

// Satori cannot parse woff2, so the two faces are vendored as truetype and read
// from disk. Nothing here may touch the network: these images are rendered at
// build time and again on demand, and a fetch would make either one fail.
const fontDirectory = join(process.cwd(), "src", "assets", "fonts");

async function loadFonts() {
  const [display, body] = await Promise.all([
    readFile(join(fontDirectory, "Newsreader-Medium.ttf")),
    readFile(join(fontDirectory, "Manrope-Medium.ttf")),
  ]);
  return [
    { name: "Newsreader", data: display, style: "normal" as const, weight: 500 as const },
    { name: "Manrope", data: body, style: "normal" as const, weight: 500 as const },
  ];
}

/**
 * Long legal titles get less room than a two-word one, so the type steps down
 * instead of overflowing the frame.
 */
function titleFontSize(title: string) {
  if (title.length > 46) return 62;
  if (title.length > 28) return 76;
  return 88;
}

export function ogImageAlt(page: OgPage) {
  return `${brand.name} — ${page.title}`;
}

export async function renderOgImage(page: OgPage) {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          // Logo pinned to the top, text centred in what is left. Anchoring the
          // text to the bottom instead left a short title like "Support"
          // stranded halfway down the card.
          justifyContent: "flex-start",
          backgroundColor: "#dfe9e2",
          padding: "80px 88px",
          fontFamily: "Manrope",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {/* Satori draws a plain img tag; next/image has no meaning here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markDataUri} width={92} height={92} alt="" />
          <span
            style={{
              fontSize: 50,
              fontFamily: "Newsreader",
              color: "#17201c",
              letterSpacing: "-0.02em",
            }}
          >
            {brand.name}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            maxWidth: 940,
          }}
        >
          <span
            style={{
              fontSize: titleFontSize(page.title),
              lineHeight: 1.08,
              fontFamily: "Newsreader",
              color: "#17201c",
              letterSpacing: "-0.035em",
            }}
          >
            {page.title}
          </span>
          {page.description ? (
            <span
              style={{
                marginTop: 26,
                fontSize: 30,
                lineHeight: 1.4,
                color: "#617069",
              }}
            >
              {page.description}
            </span>
          ) : null}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
