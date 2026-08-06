import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${brand.name} — ${brand.description}`;

const PEOPLE_GLYPH =
  "M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z";

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="242" y="242" width="540" height="540" rx="88" ry="88" fill="#2f6249" transform="rotate(15 512 512)"/>
  <circle cx="512" cy="512" r="238" fill="#e66b56"/>
  <g transform="translate(512 512) scale(1.07) translate(-128 -136)" fill="#ffffff"><path d="${PEOPLE_GLYPH}"/></g>
</svg>`;

const markDataUri = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;

// Satori cannot parse woff2, so the request omits a browser user agent to get a
// truetype url back from the Google Fonts stylesheet.
async function loadDisplayFont() {
  try {
    const stylesheet = await fetch(
      "https://fonts.googleapis.com/css2?family=Newsreader:wght@500",
    ).then((response) => response.text());
    const fontUrl = stylesheet.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!fontUrl) return null;
    return await fetch(fontUrl).then((response) => response.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const displayFont = await loadDisplayFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#dfe9e2",
          padding: "84px 88px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={markDataUri} width={104} height={104} alt="" />
          <span
            style={{
              fontSize: 58,
              fontFamily: displayFont ? "Newsreader" : undefined,
              color: "#17201c",
              letterSpacing: "-0.02em",
            }}
          >
            {brand.name}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 82,
              lineHeight: 1.05,
              fontFamily: displayFont ? "Newsreader" : undefined,
              color: "#17201c",
              letterSpacing: "-0.035em",
              maxWidth: 900,
            }}
          >
            Remember the person, not just the name.
          </span>
          <span style={{ marginTop: 28, fontSize: 30, color: "#617069" }}>
            {brand.sidebarTagline}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: displayFont
        ? [{ name: "Newsreader", data: displayFont, style: "normal", weight: 500 }]
        : undefined,
    },
  );
}
