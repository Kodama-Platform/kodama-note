import type { GetPageResult } from "@/lib/pages";

export const pageQueryKey = (slug: string) => ["page", slug] as const;

export type ExistingPage = Extract<GetPageResult, { exists: true }>;
