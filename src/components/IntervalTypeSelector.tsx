import type { IntervalType } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/stores/timerStore";

interface TypeOption {
  value: IntervalType;
  label: string;
  durationKey: "workDuration" | "shortBreakDuration" | "longBreakDuration";
}

const options: TypeOption[] = [
  { value: "work", label: "Focus", durationKey: "workDuration" },
  {
    value: "short_break",
    label: "Short Break",
    durationKey: "shortBreakDuration",
  },
  {
    value: "long_break",
    label: "Long Break",
    durationKey: "longBreakDuration",
  },
];

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

export function IntervalTypeSelector() {
  const state = useTimerStore((s) => s.state);
  const selectedType = useTimerStore((s) => s.selectedType);
  const setSelectedType = useTimerStore((s) => s.setSelectedType);
  const workDuration = useTimerStore((s) => s.workDuration);
  const shortBreakDuration = useTimerStore((s) => s.shortBreakDuration);
  const longBreakDuration = useTimerStore((s) => s.longBreakDuration);

  const isDisabled = state !== "idle";
  const durations = { workDuration, shortBreakDuration, longBreakDuration };

  return (
    <fieldset
      className="flex gap-1 rounded-lg bg-muted p-1"
      aria-label="Interval type"
      disabled={isDisabled}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer flex-col items-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
            "has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50",
            selectedType === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          data-testid={`type-${option.value}`}
        >
          <input
            type="radio"
            name="interval-type"
            value={option.value}
            checked={selectedType === option.value}
            onChange={() => setSelectedType(option.value)}
            disabled={isDisabled}
            className="sr-only"
          />
          <span>{option.label}</span>
          <span className="text-xs text-muted-foreground">
            {formatDuration(durations[option.durationKey])}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
