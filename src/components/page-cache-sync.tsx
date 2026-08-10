"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The two halves of page caching that only the page can do.
 *
 * It tells the worker which account this browser is showing, so pages kept for
 * a previous one are dropped rather than served to whoever signed in next; and
 * when the worker says the copy on screen came from the last visit, it pulls
 * the current data in underneath. The refresh is why a cached page is worth
 * showing at all — without it the reader would be looking at yesterday.
 */
export function PageCacheSync({ owner }: { owner: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const announce = () => {
      navigator.serviceWorker.controller?.postMessage({
        type: "siyi-cache-owner",
        owner,
      });
    };

    announce();
    // A first load has no controller until the worker activates, so the same
    // message goes again once one exists.
    navigator.serviceWorker.addEventListener("controllerchange", announce);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "siyi-page-revalidated") router.refresh();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", announce);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [owner, router]);

  return null;
}
