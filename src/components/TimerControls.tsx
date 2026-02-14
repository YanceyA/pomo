import { Pause, Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimerStore } from "@/stores/timerStore";

export function TimerControls() {
  const state = useTimerStore((s) => s.state);
  const startTimer = useTimerStore((s) => s.startTimer);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const cancelTimer = useTimerStore((s) => s.cancelTimer);

  if (state === "idle") {
    return (
      <div className="flex gap-3">
        <Button size="lg" onClick={startTimer} data-testid="start-button">
          <Timer className="size-5" />
          Start
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      {state === "running" ? (
        <Button
          size="lg"
          variant="secondary"
          onClick={pauseTimer}
          data-testid="pause-button"
        >
          <Pause className="size-5" />
          Pause
        </Button>
      ) : (
        <Button size="lg" onClick={resumeTimer} data-testid="resume-button">
          <Play className="size-5" />
          Resume
        </Button>
      )}
      <Button
        size="lg"
        variant="destructive"
        onClick={cancelTimer}
        data-testid="cancel-button"
      >
        <Square className="size-5" />
        Cancel
      </Button>
    </div>
  );
}
