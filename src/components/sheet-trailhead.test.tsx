import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SheetTrailhead } from "@/components/sheet-trailhead";
import type { WorkbookSheet } from "@/lib/workbook";

function sheet(
  partial: Partial<WorkbookSheet> & Pick<WorkbookSheet, "sheet_id" | "title">,
): WorkbookSheet {
  return {
    order: 0,
    markdown: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("SheetTrailhead", () => {
  it("shows add actions for a single editable sheet", () => {
    const onAdd = vi.fn();
    render(
      <SheetTrailhead
        sheets={[sheet({ sheet_id: "a", title: "Ideas", order: 0 })]}
        activeSheetId="a"
        canEdit
        onSelect={vi.fn()}
        onAdd={onAdd}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("One trail in this grove")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Private$/i }));
    expect(onAdd).toHaveBeenCalledWith("private");
  });

  it("opens a named trail list when there are multiple sheets", () => {
    const onSelect = vi.fn();
    render(
      <SheetTrailhead
        sheets={[
          sheet({ sheet_id: "a", title: "Dawn", order: 0, markdown: "Morning notes" }),
          sheet({ sheet_id: "b", title: "Dusk", order: 1, markdown: "Evening notes" }),
        ]}
        activeSheetId="a"
        activeMarkdown="Morning notes"
        canEdit
        onSelect={onSelect}
        onAdd={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Trail 1 of 2/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Trail 1 of 2/i }));
    expect(screen.getByText("Dawn")).toBeTruthy();
    expect(screen.getByText("Dusk")).toBeTruthy();
    fireEvent.click(screen.getByText("Dusk"));
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});
