import { useEffect } from "react";
import { IntervalAssociationDialog } from "@/components/IntervalAssociationDialog";
import { IntervalTypeSelector } from "@/components/IntervalTypeSelector";
import { TimerControls } from "@/components/TimerControls";
import { TimerDisplay } from "@/components/TimerDisplay";
import { useTimerStore } from "@/stores/timerStore";

function CompletionNotice() {
  const showCompletionNotice = useTimerStore((s) => s.showCompletionNotice);
  const completedIntervalType = useTimerStore((s) => s.completedIntervalType);
  const dismissCompletionNotice = useTimerStore(
    (s) => s.dismissCompletionNotice,
  );
  const completedWorkCount = useTimerStore((s) => s.completedWorkCount);
  const longBreakFrequency = useTimerStore((s) => s.longBreakFrequency);

  if (!showCompletionNotice) return null;

  const isWorkComplete = completedIntervalType === "work";
  const shouldSuggestLongBreak =
    isWorkComplete && completedWorkCount >= longBreakFrequency;

  let message: string;
  if (completedIntervalType === "work") {
    message = shouldSuggestLongBreak
      ? "Great work! Time for a long break."
      : "Focus session complete! Take a short break.";
  } else if (completedIntervalType === "long_break") {
    message = "Long break over. Ready for another round!";
  } else {
    message = "Break complete! Ready to focus.";
  }

  return (
    <div
      className="rounded-lg border bg-card p-4 text-center shadow-sm"
      data-testid="completion-notice"
    >
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={dismissCompletionNotice}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}

function PomodoroCount() {
  const completedWorkCount = useTimerStore((s) => s.completedWorkCount);
  const longBreakFrequency = useTimerStore((s) => s.longBreakFrequency);

  return (
    <p className="text-sm text-muted-foreground" data-testid="pomodoro-count">
      Pomodoro {completedWorkCount} of {longBreakFrequency}
    </p>
  );
}

export function TimerPage() {
  const loadSettings = useTimerStore((s) => s.loadSettings);
  const syncState = useTimerStore((s) => s.syncState);
  const initEventListeners = useTimerStore((s) => s.initEventListeners);

  useEffect(() => {
    loadSettings();
    syncState();
    const cleanupPromise = initEventListeners();
    return () => {
      cleanupPromise.then((unlisten) => unlisten());
    };
  }, [loadSettings, syncState, initEventListeners]);

  return (
    <section className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Pomo</h1>
      <IntervalTypeSelector />
      <TimerDisplay />
      <TimerControls />
      <PomodoroCount />
      <CompletionNotice />
      <IntervalAssociationDialog />
    </section>
  );
}
