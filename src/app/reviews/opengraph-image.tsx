import { ogImageAlt, renderOgImage } from "@/lib/og-image";
import { publicPages } from "@/lib/public-pages";

export { contentType, size } from "@/lib/og-image";

const page = publicPages.reviews;

export const alt = ogImageAlt(page);

export default function OpenGraphImage() {
  return renderOgImage(page);
}
