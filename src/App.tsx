import { BarChart3, Timer } from "lucide-react";
import { useState } from "react";
import { ReportsPage } from "@/components/ReportsPage";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TaskList } from "@/components/TaskList";
import { TimerPage } from "@/components/TimerPage";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

type AppView = "timer" | "reports";

function App() {
  const [view, setView] = useState<AppView>("timer");

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      {/* Top bar: nav + settings */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          variant={view === "timer" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("timer")}
        >
          <Timer className="mr-1 size-4" />
          Timer
        </Button>
        <Button
          variant={view === "reports" ? "default" : "ghost"}
          size="sm"
          onClick={() => setView("reports")}
        >
          <BarChart3 className="mr-1 size-4" />
          Reports
        </Button>
        <SettingsPanel />
      </div>

      {view === "timer" ? (
        <>
          <TimerPage />
          <TaskList />
        </>
      ) : (
        <ReportsPage />
      )}
      <Toaster />
    </main>
  );
}

export default App;
