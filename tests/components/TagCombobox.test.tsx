import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagCombobox } from "@/components/TagCombobox";
import type { Tag } from "@/db/tags";

describe("TagCombobox", () => {
  const allTags: Tag[] = [
    { id: 1, name: "infra",    color: "#fef3c7" },
    { id: 2, name: "advisor",  color: "#dbeafe" },
    { id: 3, name: "to-meet",  color: "#dcfce7" },
  ];

  it("renders existing tags as removable chips", () => {
    const onRemove = vi.fn();
    render(
      <TagCombobox personTags={[allTags[0]]} allTags={allTags} onAdd={vi.fn()} onCreate={vi.fn()} onRemove={onRemove} />
    );
    expect(screen.getByText("infra")).toBeInTheDocument();
  });

  it("shows autocomplete suggestions after typing, excluding already-attached tags", async () => {
    const user = userEvent.setup();
    render(
      <TagCombobox personTags={[allTags[0]]} allTags={allTags} onAdd={vi.fn()} onCreate={vi.fn()} onRemove={vi.fn()} />
    );
    await user.click(screen.getByPlaceholderText(/add tag/i));
    await user.keyboard("a");
    expect(screen.getByText("advisor")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "infra" })).not.toBeInTheDocument();
  });

  it("calls onAdd for an existing tag selection", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <TagCombobox personTags={[]} allTags={allTags} onAdd={onAdd} onCreate={vi.fn()} onRemove={vi.fn()} />
    );
    await user.click(screen.getByPlaceholderText(/add tag/i));
    await user.keyboard("inf");
    await user.click(screen.getByText("infra"));
    expect(onAdd).toHaveBeenCalledWith(allTags[0]);
  });

  it("calls onCreate with new name + random palette color when no match exists", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(
      <TagCombobox personTags={[]} allTags={allTags} onAdd={vi.fn()} onCreate={onCreate} onRemove={vi.fn()} />
    );
    await user.click(screen.getByPlaceholderText(/add tag/i));
    await user.keyboard("brand-new{Enter}");
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0]).toBe("brand-new");
    expect(onCreate.mock.calls[0][1]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
