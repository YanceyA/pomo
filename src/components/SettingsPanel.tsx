import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import * as settingsRepository from "@/lib/settingsRepository";
import { useTimerStore } from "@/stores/timerStore";

interface SettingsFormValues {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakFrequency: number;
}

const PRESETS: { label: string; values: SettingsFormValues }[] = [
  {
    label: "25 / 5",
    values: {
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakFrequency: 4,
    },
  },
  {
    label: "35 / 7",
    values: {
      workDuration: 35,
      shortBreakDuration: 7,
      longBreakDuration: 21,
      longBreakFrequency: 4,
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validate(values: SettingsFormValues): string | null {
  if (
    values.workDuration < 1 ||
    values.workDuration > 60 ||
    !Number.isInteger(values.workDuration)
  ) {
    return "Work duration must be a whole number between 1 and 60.";
  }
  if (
    values.shortBreakDuration < 1 ||
    values.shortBreakDuration > 30 ||
    !Number.isInteger(values.shortBreakDuration)
  ) {
    return "Short break must be a whole number between 1 and 30.";
  }
  if (
    values.longBreakDuration < 5 ||
    values.longBreakDuration > 60 ||
    !Number.isInteger(values.longBreakDuration)
  ) {
    return "Long break must be a whole number between 5 and 60.";
  }
  if (
    values.longBreakFrequency < 1 ||
    values.longBreakFrequency > 10 ||
    !Number.isInteger(values.longBreakFrequency)
  ) {
    return "Long break frequency must be a whole number between 1 and 10.";
  }
  return null;
}

export function SettingsPanel() {
  const timerState = useTimerStore((s) => s.state);
  const loadSettings = useTimerStore((s) => s.loadSettings);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SettingsFormValues>({
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakFrequency: 4,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const settings = await settingsRepository.getAll();
      const map = new Map(settings.map((s) => [s.key, s.value]));
      setForm({
        workDuration: Number(map.get("work_duration_minutes")) || 25,
        shortBreakDuration:
          Number(map.get("short_break_duration_minutes")) || 5,
        longBreakDuration: Number(map.get("long_break_duration_minutes")) || 15,
        longBreakFrequency: Number(map.get("long_break_frequency")) || 4,
      });
      setError(null);
    })();
  }, [open]);

  const handleChange = (field: keyof SettingsFormValues, raw: string) => {
    const num = raw === "" ? 0 : Number.parseInt(raw, 10);
    if (Number.isNaN(num)) return;
    setForm((prev) => ({ ...prev, [field]: num }));
    setError(null);
  };

  const applyPreset = (preset: SettingsFormValues) => {
    setForm(preset);
    setError(null);
  };

  const handleSave = async () => {
    const clamped: SettingsFormValues = {
      workDuration: clamp(form.workDuration, 1, 60),
      shortBreakDuration: clamp(form.shortBreakDuration, 1, 30),
      longBreakDuration: clamp(form.longBreakDuration, 5, 60),
      longBreakFrequency: clamp(form.longBreakFrequency, 1, 10),
    };

    const validationError = validate(clamped);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await settingsRepository.set(
        "work_duration_minutes",
        String(clamped.workDuration),
      );
      await settingsRepository.set(
        "short_break_duration_minutes",
        String(clamped.shortBreakDuration),
      );
      await settingsRepository.set(
        "long_break_duration_minutes",
        String(clamped.longBreakDuration),
      );
      await settingsRepository.set(
        "long_break_frequency",
        String(clamped.longBreakFrequency),
      );
      await loadSettings();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const isTimerActive = timerState !== "idle";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="settings-trigger"
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent data-testid="settings-panel">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure timer durations and preferences.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4">
          {isTimerActive && (
            <p
              className="text-sm text-amber-600"
              data-testid="settings-timer-warning"
            >
              Changes will apply to the next interval, not the current one.
            </p>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="work-duration">Work duration (minutes)</Label>
              <Input
                id="work-duration"
                data-testid="settings-work-duration"
                type="number"
                min={1}
                max={60}
                value={form.workDuration}
                onChange={(e) => handleChange("workDuration", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="short-break-duration">
                Short break (minutes)
              </Label>
              <Input
                id="short-break-duration"
                data-testid="settings-short-break"
                type="number"
                min={1}
                max={30}
                value={form.shortBreakDuration}
                onChange={(e) =>
                  handleChange("shortBreakDuration", e.target.value)
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="long-break-duration">Long break (minutes)</Label>
              <Input
                id="long-break-duration"
                data-testid="settings-long-break"
                type="number"
                min={5}
                max={60}
                value={form.longBreakDuration}
                onChange={(e) =>
                  handleChange("longBreakDuration", e.target.value)
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="long-break-frequency">
                Long break after (pomodoros)
              </Label>
              <Input
                id="long-break-frequency"
                data-testid="settings-frequency"
                type="number"
                min={1}
                max={10}
                value={form.longBreakFrequency}
                onChange={(e) =>
                  handleChange("longBreakFrequency", e.target.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Presets</Label>
            <div className="flex gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  data-testid={`settings-preset-${preset.label.replace(/\s*\/\s*/g, "-")}`}
                  onClick={() => applyPreset(preset.values)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {error && (
            <p
              className="text-sm text-destructive"
              data-testid="settings-error"
            >
              {error}
            </p>
          )}

          <Button
            data-testid="settings-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
