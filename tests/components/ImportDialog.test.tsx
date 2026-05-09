import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportDialog } from "@/components/ImportDialog";
import { makeTestDb } from "../helpers/testDb";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue("/fake/snapshot.sqlite"),
}));

const SAMPLE_CSV =
  `First Name,Last Name,URL,Email Address,Company,Position,Connected On\n` +
  `Sarah,Chen,https://www.linkedin.com/in/sarah,,Stripe,Engineer,16 Mar 2024\n` +
  `John,Park,https://www.linkedin.com/in/john,,Google,PM,03 Jan 2023\n`;

describe("ImportDialog", () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const fs = await import("@tauri-apps/plugin-fs");
    vi.mocked(dialog.open).mockResolvedValue("/fake/Connections.csv");
    vi.mocked(fs.readTextFile).mockResolvedValue(SAMPLE_CSV);
    onComplete = vi.fn();
  });

  it("imports a CSV and reports counts", async () => {
    const db = await makeTestDb();
    render(<ImportDialog db={db} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /choose connections\.csv/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ added: 2, updated: 0, archived: 0 })
    );
  });
});
