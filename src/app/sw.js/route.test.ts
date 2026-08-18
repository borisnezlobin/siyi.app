import { beforeEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import { GET } from "./route";

/**
 * The worker is generated as a string, which used to be treated as a reason to
 * assert on the string. It is the opposite: a string is the one thing that can
 * be handed to `new Function` and actually run. These boot the real source
 * against a fake `caches` and `fetch` and check what it does, because every rule
 * in this file is a silent failure — caching keeps working when the rule that
 * stops it caching the wrong thing is deleted.
 */

const origin = "https://siyi.app";

/**
 * Where this build's assets land. Asserting on the name itself would only
 * restate the expression in route.ts, so it is used to find the store and the
 * assertions are about what ends up in it.
 */
const shellCache = `${brand.slug}-shell-${
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"
}`;

type WorkerEvent = {
  request?: FakeRequest;
  waitUntil: (value: Promise<unknown>) => void;
  respondWith: (value: Response | Promise<Response>) => void;
};

type FakeRequest = {
  url: string;
  method: string;
  mode: string;
};

function request(path: string, extra: Partial<FakeRequest> = {}): FakeRequest {
  return { url: `${origin}${path}`, method: "GET", mode: "no-cors", ...extra };
}

function cacheKey(target: FakeRequest | string) {
  return typeof target === "string" ? `${origin}${target}` : target.url;
}

async function bootWorker(fetchImpl: (input: FakeRequest) => Promise<Response>) {
  const source = await GET().text();
  const stores = new Map<string, Map<string, Response>>();
  const pending: Promise<unknown>[] = [];
  const listeners = new Map<string, ((event: WorkerEvent) => void)[]>();

  function openStore(name: string) {
    const existing = stores.get(name);
    if (existing) return existing;
    const created = new Map<string, Response>();
    stores.set(name, created);
    return created;
  }

  function makeCache(name: string) {
    return {
      put: async (key: FakeRequest | string, value: Response) => {
        openStore(name).set(cacheKey(key), value);
      },
      match: async (key: FakeRequest | string) =>
        openStore(name).get(cacheKey(key)),
      add: async (path: string) => {
        const response = await fetchImpl(request(path));
        if (!response.ok) throw new Error(`failed to add ${path}`);
        openStore(name).set(cacheKey(path), response);
      },
    };
  }

  const caches = {
    open: async (name: string) => makeCache(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (key: FakeRequest | string) => {
      for (const store of stores.values()) {
        const hit = store.get(cacheKey(key));
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const self = {
    location: { origin },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
    registration: {},
    addEventListener: (type: string, handler: (event: WorkerEvent) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
  };

  new Function("self", "caches", "fetch", source)(self, caches, fetchImpl);

  async function dispatch(type: string, request?: FakeRequest) {
    let responded: Response | Promise<Response> | undefined;
    const event: WorkerEvent = {
      request,
      waitUntil: (value) => {
        pending.push(value);
      },
      respondWith: (value) => {
        responded = value;
      },
    };
    for (const handler of listeners.get(type) ?? []) handler(event);
    await Promise.all(pending.splice(0));
    return responded ? await responded : undefined;
  }

  return { dispatch, stores, self };
}

/**
 * The worker only stores a response whose `type` is "basic" — a same-origin
 * reply rather than an opaque cross-origin one — and `type` is read-only on a
 * real Response, so the fake has to say so itself.
 */
function sameOrigin(body: string, status = 200) {
  const response = new Response(body, {
    status,
    headers: { "Content-Type": "text/html" },
  });
  Object.defineProperty(response, "type", { value: "basic" });
  return response;
}

const okHtml = () => sameOrigin("<html>fresh</html>");

/** The worker writes to the cache without awaiting it, as it does in a browser. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the service worker", () => {
  let network: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    network = vi.fn(async () => okHtml());
  });

  it("never stores a page a signed-in person is looking at", async () => {
    const worker = await bootWorker(network as never);
    await worker.dispatch("install");
    await worker.dispatch("activate");

    const response = await worker.dispatch(
      "fetch",
      request("/people", { mode: "navigate" }),
    );

    expect(await response!.text()).toBe("<html>fresh</html>");
    // The whole point. /people used to be written to disk and replayed on the
    // next cold open, which is how last visit's names outlived them.
    const everythingStored = [...worker.stores.values()].flatMap((store) => [
      ...store.keys(),
    ]);
    expect(everythingStored).not.toContain(`${origin}/people`);
  });

  it("goes to the network for a page every single time", async () => {
    const worker = await bootWorker(network as never);
    await worker.dispatch("install");
    await worker.dispatch("activate");

    await worker.dispatch("fetch", request("/today", { mode: "navigate" }));
    await worker.dispatch("fetch", request("/today", { mode: "navigate" }));

    const pageRequests = network.mock.calls.filter(
      (call) => (call[0] as FakeRequest).url === `${origin}/today`,
    );
    expect(pageRequests).toHaveLength(2);
  });

  it("shows the offline page when a page cannot be reached", async () => {
    const worker = await bootWorker((input) => {
      if (input.url.endsWith("/offline")) {
        return Promise.resolve(sameOrigin("offline page"));
      }
      if (input.mode === "navigate") return Promise.reject(new Error("no network"));
      return Promise.resolve(okHtml());
    });
    await worker.dispatch("install");

    const response = await worker.dispatch(
      "fetch",
      request("/today", { mode: "navigate" }),
    );

    expect(await response!.text()).toBe("offline page");
  });

  it("still answers when even the offline page was never stored", async () => {
    const worker = await bootWorker(() => Promise.reject(new Error("no network")));
    await worker.dispatch("install");

    const response = await worker.dispatch(
      "fetch",
      request("/today", { mode: "navigate" }),
    );

    // respondWith(undefined) is a network error and shows the browser's own
    // error page instead of ours.
    expect(response).toBeInstanceOf(Response);
    expect(response!.status).toBe(503);
  });

  it("installs even when one shell asset is missing", async () => {
    const worker = await bootWorker(async (input) =>
      input.url.endsWith("/icon-512.png")
        ? sameOrigin("", 404)
        : sameOrigin("asset"),
    );

    // addAll rejects as a unit, so one missing file used to leave the worker
    // unable to install at all.
    await expect(worker.dispatch("install")).resolves.toBeUndefined();
    const shell = worker.stores.get(shellCache);
    expect(shell?.has(`${origin}/offline`)).toBe(true);
  });

  it("caches build assets but not anything else", async () => {
    const worker = await bootWorker(network as never);
    await worker.dispatch("install");

    await worker.dispatch("fetch", request("/_next/static/chunks/main.js"));
    await worker.dispatch("fetch", request("/api/quick-people"));
    await settle();

    const shell = worker.stores.get(shellCache)!;
    expect(shell.has(`${origin}/_next/static/chunks/main.js`)).toBe(true);
    expect(shell.has(`${origin}/api/quick-people`)).toBe(false);
  });

  it("throws away every cache that is not this build's", async () => {
    const worker = await bootWorker(network as never);
    await worker.dispatch("install");

    // What an install from before this change left behind: signed-in HTML, and
    // a shell pinned to a build that no longer exists.
    worker.stores.set(
      `${brand.slug}-pages-v1`,
      new Map([[`${origin}/people`, okHtml()]]),
    );
    // And a shell from a build that no longer exists. Two builds sharing a
    // cache is the failure that could not be retried out of: a document from
    // one, the chunks it names from the other.
    worker.stores.set(`${brand.slug}-shell-older`, new Map());

    await worker.dispatch("activate");

    expect([...worker.stores.keys()]).toEqual([shellCache]);
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });
});
