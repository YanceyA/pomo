import { ChevronLeft, ChevronRight, Clock, Target, Timer } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { IntervalSummary, TaskGroup } from "@/lib/schemas";
import { useReportStore } from "@/stores/reportStore";

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function intervalTypeLabel(type: string): string {
  switch (type) {
    case "work":
      return "Focus";
    case "short_break":
      return "Short Break";
    case "long_break":
      return "Long Break";
    default:
      return type;
  }
}

function intervalTypeColor(type: string): string {
  switch (type) {
    case "work":
      return "text-primary";
    case "short_break":
      return "text-emerald-500";
    case "long_break":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function IntervalList({ intervals }: { intervals: IntervalSummary[] }) {
  if (intervals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No completed intervals for this day.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {intervals.map((interval) => (
        <div
          key={interval.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2">
            <span className={intervalTypeColor(interval.interval_type)}>
              {intervalTypeLabel(interval.interval_type)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>{formatTime(interval.start_time)}</span>
            <span>-</span>
            <span>
              {interval.end_time ? formatTime(interval.end_time) : "—"}
            </span>
            <span className="min-w-[3rem] text-right font-mono text-xs">
              {formatDuration(interval.duration_seconds)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskGroups({ groups }: { groups: TaskGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tasks for this day.</p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.jira_key ?? "__none"} className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase">
            {group.jira_key ?? "No Jira ticket"}
          </h4>
          {group.tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    task.status === "completed"
                      ? "text-foreground"
                      : task.status === "abandoned"
                        ? "italic text-muted-foreground"
                        : "text-foreground"
                  }
                >
                  {task.title}
                </span>
                {task.tag && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {task.tag}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {task.completed_in_pomodoro != null &&
                  task.completed_in_pomodoro > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      Pomodoro {task.completed_in_pomodoro}
                    </span>
                  )}
                <span
                  className={
                    task.status === "completed"
                      ? "text-emerald-500"
                      : task.status === "abandoned"
                        ? "text-amber-500"
                        : ""
                  }
                >
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DailySummary() {
  const dailyDate = useReportStore((s) => s.dailyDate);
  const summary = useReportStore((s) => s.dailySummary);
  const isLoading = useReportStore((s) => s.isDailyLoading);
  const loadDailySummary = useReportStore((s) => s.loadDailySummary);
  const prevDay = useReportStore((s) => s.prevDay);
  const nextDay = useReportStore((s) => s.nextDay);
  const goToToday = useReportStore((s) => s.goToToday);

  useEffect(() => {
    loadDailySummary();
  }, [loadDailySummary]);

  const isToday = dailyDate === todayStr();

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevDay}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium">
            {isToday ? "Today" : formatDate(dailyDate)}
          </span>
          <Button variant="ghost" size="icon" onClick={nextDay}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!isToday && (
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : summary ? (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Timer className="size-5" />}
              label="Pomodoros"
              value={String(summary.pomodoro_count)}
            />
            <StatCard
              icon={<Clock className="size-5" />}
              label="Focus time"
              value={formatDuration(summary.total_focus_minutes * 60)}
            />
            <StatCard
              icon={<Target className="size-5" />}
              label="Tasks done"
              value={`${summary.tasks_completed}/${summary.tasks_total}`}
            />
          </div>

          {/* Intervals */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Intervals</h3>
            <IntervalList intervals={summary.intervals} />
          </div>

          {/* Tasks by Jira ticket */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Tasks</h3>
            <TaskGroups groups={summary.task_groups} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No data available for this day.
        </p>
      )}
    </div>
  );
}
