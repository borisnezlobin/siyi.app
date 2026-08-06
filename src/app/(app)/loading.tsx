/**
 * Every page in here is server-rendered per request, so without a loading state
 * the browser sits on the old page until the server answers and a tab switch
 * feels broken. This renders instantly, and it is also what lets Next prefetch
 * these routes at all.
 */
export default function AppSectionLoading() {
  return (
    <div
      className="mx-auto max-w-[980px] animate-pulse px-4 py-5 sm:px-7 sm:py-9 lg:px-10 lg:py-12"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>

      <div className="h-4 w-28 rounded-full bg-ink/10" />
      <div className="mt-4 h-10 w-64 rounded-2xl bg-ink/10" />

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="rounded-[1.75rem] bg-paper p-5 shadow-card">
              <div className="flex items-center gap-3">
                <div className="size-11 shrink-0 rounded-full bg-ink/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 rounded-full bg-ink/10" />
                  <div className="h-3 w-1/4 rounded-full bg-ink/[0.07]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden space-y-4 lg:block">
          <div className="rounded-[1.75rem] bg-paper p-5 shadow-card">
            <div className="h-3.5 w-24 rounded-full bg-ink/10" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded-full bg-ink/[0.07]" />
              <div className="h-3 w-4/5 rounded-full bg-ink/[0.07]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
