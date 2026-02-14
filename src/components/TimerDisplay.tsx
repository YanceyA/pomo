import type { IntervalType } from "@/lib/schemas";
import { useTimerStore } from "@/stores/timerStore";

const RING_SIZE = 220;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTypeColor(type: IntervalType): string {
  switch (type) {
    case "work":
      return "text-primary";
    case "short_break":
      return "text-emerald-500";
    case "long_break":
      return "text-blue-500";
  }
}

function getRingStroke(type: IntervalType): string {
  switch (type) {
    case "work":
      return "stroke-primary";
    case "short_break":
      return "stroke-emerald-500";
    case "long_break":
      return "stroke-blue-500";
  }
}

function getTypeLabel(type: IntervalType): string {
  switch (type) {
    case "work":
      return "Focus";
    case "short_break":
      return "Short Break";
    case "long_break":
      return "Long Break";
  }
}

export function TimerDisplay() {
  const state = useTimerStore((s) => s.state);
  const intervalType = useTimerStore((s) => s.intervalType);
  const selectedType = useTimerStore((s) => s.selectedType);
  const remainingMs = useTimerStore((s) => s.remainingMs);
  const plannedDurationSeconds = useTimerStore((s) => s.plannedDurationSeconds);
  const workDuration = useTimerStore((s) => s.workDuration);
  const shortBreakDuration = useTimerStore((s) => s.shortBreakDuration);
  const longBreakDuration = useTimerStore((s) => s.longBreakDuration);

  const isActive = state !== "idle";
  const displayType = isActive ? intervalType : selectedType;
  const displayMs = isActive
    ? remainingMs
    : getDurationMs(
        selectedType,
        workDuration,
        shortBreakDuration,
        longBreakDuration,
      );
  const totalMs = isActive
    ? plannedDurationSeconds * 1000
    : getDurationMs(
        selectedType,
        workDuration,
        shortBreakDuration,
        longBreakDuration,
      );

  const progress = totalMs > 0 ? displayMs / totalMs : 1;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div
      className="relative flex items-center justify-center"
      data-testid="timer-display"
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="stroke-muted"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className={`${getRingStroke(displayType)} transition-[stroke-dashoffset] duration-300`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-5xl font-mono font-bold tabular-nums ${getTypeColor(displayType)}`}
        >
          {formatTime(displayMs)}
        </span>
        <span className="text-sm text-muted-foreground mt-1">
          {getTypeLabel(displayType)}
        </span>
      </div>
    </div>
  );
}

function getDurationMs(
  type: IntervalType,
  work: number,
  shortBreak: number,
  longBreak: number,
): number {
  switch (type) {
    case "work":
      return work * 1000;
    case "short_break":
      return shortBreak * 1000;
    case "long_break":
      return longBreak * 1000;
  }
}
