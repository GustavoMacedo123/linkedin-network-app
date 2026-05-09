import { Sidebar } from "./Sidebar";
import { GraphCanvas } from "./GraphCanvas";
import { ProfilePanel } from "./ProfilePanel";
import { SettingsModal } from "./SettingsModal";

export function Layout() {
  return (
    <>
      <div className="h-full grid grid-cols-[240px_1fr_280px] divide-x divide-neutral-200 bg-neutral-50">
        <Sidebar />
        <GraphCanvas />
        <ProfilePanel />
      </div>
      <SettingsModal />
    </>
  );
}
