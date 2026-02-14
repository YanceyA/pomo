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
import type { WeekStat } from "@/lib/schemas";
import { useReportStore } from "@/stores/reportStore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function formatMonthYear(monthStart: string): string {
  const d = new Date(`${monthStart}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function isCurrentMonth(monthStart: string): boolean {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return monthStart === current;
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

function PomodoroChart({ weeklyStats }: { weeklyStats: WeekStat[] }) {
  const chartData = useMemo(
    () => ({
      labels: weeklyStats.map((w) => `${formatShortDate(w.week_start)}`),
      datasets: [
        {
          label: "Pomodoros",
          data: weeklyStats.map((w) => w.pomodoro_count),
          backgroundColor: "hsl(var(--primary))",
          borderRadius: 4,
        },
      ],
    }),
    [weeklyStats],
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
              const stat = weeklyStats[ctx.dataIndex];
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
    [weeklyStats],
  );

  return (
    <div className="h-48">
      <Bar data={chartData} options={options} />
    </div>
  );
}

function WeeklyBreakdown({ weeklyStats }: { weeklyStats: WeekStat[] }) {
  return (
    <div className="space-y-1">
      {weeklyStats.map((stat) => (
        <div
          key={stat.week_start}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span className="min-w-[10rem] font-medium">
            {formatWeekLabel(stat.week_start, stat.week_end)}
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

export function MonthlySummary() {
  const monthStart = useReportStore((s) => s.monthStart);
  const summary = useReportStore((s) => s.monthlySummary);
  const isLoading = useReportStore((s) => s.isMonthlyLoading);
  const loadMonthlySummary = useReportStore((s) => s.loadMonthlySummary);
  const prevMonth = useReportStore((s) => s.prevMonth);
  const nextMonth = useReportStore((s) => s.nextMonth);
  const goToCurrentMonth = useReportStore((s) => s.goToCurrentMonth);

  useEffect(() => {
    loadMonthlySummary();
  }, [loadMonthlySummary]);

  const isCurrent = isCurrentMonth(monthStart);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[12rem] text-center text-sm font-medium">
            {isCurrent ? "This Month" : formatMonthYear(monthStart)}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!isCurrent && (
          <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
            This Month
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
            <h3 className="mb-2 text-sm font-medium">Pomodoros per week</h3>
            <PomodoroChart weeklyStats={summary.weekly_stats} />
          </div>

          {/* Weekly breakdown */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Weekly breakdown</h3>
            <WeeklyBreakdown weeklyStats={summary.weekly_stats} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No data available for this month.
        </p>
      )}
    </div>
  );
}
