import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/command-palette";
import { NoteShell } from "@/components/site/note-shell";

function NotFoundComponent() {
  return (
    <NoteShell centered footer="feature">
      <div className="note-card w-full max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-clay">404</p>
        <h1 className="mt-4 font-display text-[1.65rem] font-light leading-tight tracking-tight text-foreground sm:text-3xl">
          Page not found
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <div className="mt-8">
          <Link to="/" className="btn-moss inline-flex items-center justify-center">
            Back to Kodama
          </Link>
        </div>
      </div>
    </NoteShell>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <NoteShell centered footer="feature">
      <div className="note-card w-full max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-clay">Error</p>
        <h1 className="mt-4 font-display text-xl font-light tracking-tight text-foreground sm:text-2xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-muted-foreground">
          Try again, or head back to the start.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-moss">
            Try again
          </button>
          <a href="/" className="note-toolbar-btn !h-11 !px-5">
            Home
          </a>
        </div>
      </div>
    </NoteShell>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
      <CommandPalette />
    </>
  );
}
