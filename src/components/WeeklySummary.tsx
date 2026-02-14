import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { ChevronLeft, ChevronRight, Clock, Target, Timer } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import { Button } from "@/components/ui/button";
import type { DailyStat, TaskGroup } from "@/lib/schemas";
import { useReportStore } from "@/stores/reportStore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWeekRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sStr = s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const eStr = e.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${sStr} – ${eStr}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function isCurrentWeek(weekStart: string): boolean {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + diff);
  const currentMonday = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  return weekStart === currentMonday;
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

function PomodoroChart({ dailyStats }: { dailyStats: DailyStat[] }) {
  const chartData = useMemo(
    () => ({
      labels: dailyStats.map((d) => getDayLabel(d.date)),
      datasets: [
        {
          label: "Pomodoros",
          data: dailyStats.map((d) => d.pomodoro_count),
          backgroundColor: "hsl(var(--primary))",
          borderRadius: 4,
        },
      ],
    }),
    [dailyStats],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx: { dataIndex: number }) => {
              const stat = dailyStats[ctx.dataIndex];
              return `Tasks: ${stat.tasks_completed} | Focus: ${formatDuration(stat.focus_minutes * 60)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
        },
      },
    }),
    [dailyStats],
  );

  return (
    <div className="h-48">
      <Bar data={chartData} options={options} />
    </div>
  );
}

function DailyBreakdown({ dailyStats }: { dailyStats: DailyStat[] }) {
  return (
    <div className="space-y-1">
      {dailyStats.map((stat) => (
        <div
          key={stat.date}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span className="min-w-[7rem] font-medium">
            {formatShortDate(stat.date)}
          </span>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Timer className="size-3" />
              {stat.pomodoro_count}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(stat.focus_minutes * 60)}
            </span>
            <span className="flex items-center gap-1">
              <Target className="size-3" />
              {stat.tasks_completed}
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
      <p className="text-sm text-muted-foreground">No tasks for this week.</p>
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
                <span>{task.title}</span>
                {task.tag && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                    {task.tag}
                  </span>
                )}
              </div>
              <span
                className={
                  task.status === "completed"
                    ? "text-xs text-emerald-500"
                    : task.status === "abandoned"
                      ? "text-xs text-amber-500"
                      : "text-xs text-muted-foreground"
                }
              >
                {task.status}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function WeeklySummary() {
  const weekStart = useReportStore((s) => s.weekStart);
  const summary = useReportStore((s) => s.weeklySummary);
  const isLoading = useReportStore((s) => s.isWeeklyLoading);
  const loadWeeklySummary = useReportStore((s) => s.loadWeeklySummary);
  const prevWeek = useReportStore((s) => s.prevWeek);
  const nextWeek = useReportStore((s) => s.nextWeek);
  const goToCurrentWeek = useReportStore((s) => s.goToCurrentWeek);

  useEffect(() => {
    loadWeeklySummary();
  }, [loadWeeklySummary]);

  const isCurrent = isCurrentWeek(weekStart);

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[12rem] text-center text-sm font-medium">
            {isCurrent
              ? "This Week"
              : summary
                ? formatWeekRange(summary.week_start, summary.week_end)
                : formatShortDate(weekStart)}
          </span>
          <Button variant="ghost" size="icon" onClick={nextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!isCurrent && (
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            This Week
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
              value={String(summary.total_pomodoros)}
            />
            <StatCard
              icon={<Clock className="size-5" />}
              label="Focus time"
              value={formatDuration(summary.total_focus_minutes * 60)}
            />
            <StatCard
              icon={<Target className="size-5" />}
              label="Tasks done"
              value={String(summary.total_tasks_completed)}
            />
          </div>

          {/* Bar chart */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Pomodoros per day</h3>
            <PomodoroChart dailyStats={summary.daily_stats} />
          </div>

          {/* Daily breakdown */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Daily breakdown</h3>
            <DailyBreakdown dailyStats={summary.daily_stats} />
          </div>

          {/* Tasks by Jira ticket */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Tasks</h3>
            <TaskGroups groups={summary.task_groups} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No data available for this week.
        </p>
      )}
    </div>
  );
}
