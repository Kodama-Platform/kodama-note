import { useCallback, useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  ArrowRight,
  Check,
  Copy,
  Focus,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import {
  applyTheme,
  getStoredTheme,
  setTheme as persistTheme,
  type Theme,
} from "@/lib/theme";

/**
 * Global command palette — Cmd/Ctrl+K
 *
 * Context-aware: page actions (Copy Link, Focus Mode, Reading Mode) light up
 * when we're on a /:slug route. Otherwise only navigation + theme appear.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [pageName, setPageName] = useState("");
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Resolve the current page slug from the URL, if any.
  const path = router.state.location.pathname;
  const slugMatch = path.match(/^\/([^/]+)$/);
  const currentSlug = slugMatch && slugMatch[1] !== "" ? slugMatch[1] : null;

  const run = useCallback((fn: () => void | Promise<void>) => {
    return async () => {
      setOpen(false);
      await fn();
    };
  }, []);

  const setThemeAndToast = (t: Theme) => {
    persistTheme(t);
    applyTheme(t);
    toast.success(`Theme: ${t.charAt(0).toUpperCase() + t.slice(1)}`);
  };

  const copyLink = async () => {
    const url = window.location.origin + (currentSlug ? `/${currentSlug}` : "");
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", {
        icon: <Check className="h-4 w-4 animate-pop" />,
      });
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const goToPage = (slug: string) => {
    const trimmed = slug.trim().replace(/^\/+/, "");
    if (!trimmed) return;
    navigate({ to: "/$slug", params: { slug: trimmed } });
  };

  const dispatchEditorEvent = (name: string) => {
    window.dispatchEvent(new CustomEvent(name));
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search actions or type a page name…"
        value={pageName}
        onValueChange={setPageName}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {pageName.trim() && (
          <CommandGroup heading="Navigate">
            <CommandItem
              onSelect={run(() => goToPage(pageName))}
              value={`open-${pageName}`}
            >
              <ArrowRight className="h-4 w-4" />
              Open <span className="text-muted-foreground">/{pageName.trim()}</span>
            </CommandItem>
          </CommandGroup>
        )}

        {currentSlug && (
          <CommandGroup heading="This page">
            <CommandItem onSelect={run(copyLink)}>
              <Copy className="h-4 w-4" /> Copy page link
              <CommandShortcut>⌘⇧C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={run(() => dispatchEditorEvent("kodama:toggle-focus"))}>
              <Focus className="h-4 w-4" /> Toggle focus mode
            </CommandItem>
            <CommandItem onSelect={run(() => dispatchEditorEvent("kodama:export"))}>
              <ArrowRight className="h-4 w-4" /> Export note
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={run(() => setThemeAndToast("light"))}>
            <Sun className="h-4 w-4" /> Light
            {getStoredTheme() === "light" && <Check className="ml-auto h-4 w-4" />}
          </CommandItem>
          <CommandItem onSelect={run(() => setThemeAndToast("dark"))}>
            <Moon className="h-4 w-4" /> Dark
            {getStoredTheme() === "dark" && <Check className="ml-auto h-4 w-4" />}
          </CommandItem>
          <CommandItem onSelect={run(() => setThemeAndToast("system"))}>
            <Monitor className="h-4 w-4" /> System
            {getStoredTheme() === "system" && <Check className="ml-auto h-4 w-4" />}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
