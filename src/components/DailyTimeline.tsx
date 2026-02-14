import "chartjs-adapter-date-fns";
import {
  BarElement,
  Chart as ChartJS,
  Legend,
  LinearScale,
  TimeScale,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import type { IntervalSummary } from "@/lib/schemas";

ChartJS.register(TimeScale, LinearScale, BarElement, Tooltip, Legend);

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

interface DailyTimelineProps {
  intervals: IntervalSummary[];
  date: string;
}

export function DailyTimeline({ intervals, date }: DailyTimelineProps) {
  const { chartData, options } = useMemo(() => {
    if (intervals.length === 0) {
      return { chartData: null, options: null };
    }

    const workData: [number, number][] = [];
    const shortBreakData: [number, number][] = [];
    const longBreakData: [number, number][] = [];

    for (const interval of intervals) {
      const start = new Date(interval.start_time).getTime();
      const end = interval.end_time
        ? new Date(interval.end_time).getTime()
        : start + interval.duration_seconds * 1000;

      const pair: [number, number] = [start, end];

      switch (interval.interval_type) {
        case "work":
          workData.push(pair);
          shortBreakData.push([0, 0]);
          longBreakData.push([0, 0]);
          break;
        case "short_break":
          workData.push([0, 0]);
          shortBreakData.push(pair);
          longBreakData.push([0, 0]);
          break;
        case "long_break":
          workData.push([0, 0]);
          shortBreakData.push([0, 0]);
          longBreakData.push(pair);
          break;
      }
    }

    // Compute x-axis range: min 8AM–10PM, or extend to data bounds
    const allTimes = intervals.flatMap((i) => {
      const s = new Date(i.start_time).getTime();
      const e = i.end_time
        ? new Date(i.end_time).getTime()
        : s + i.duration_seconds * 1000;
      return [s, e];
    });
    const dataMin = Math.min(...allTimes);
    const dataMax = Math.max(...allTimes);

    const day8am = new Date(`${date}T08:00:00`).getTime();
    const day10pm = new Date(`${date}T22:00:00`).getTime();

    const xMin = Math.min(dataMin, day8am);
    const xMax = Math.max(dataMax, day10pm);

    return {
      chartData: {
        labels: intervals.map((_, i) => String(i)),
        datasets: [
          {
            label: "Focus",
            data: workData,
            backgroundColor: "hsl(var(--primary))",
            borderRadius: 3,
            barPercentage: 0.8,
          },
          {
            label: "Short Break",
            data: shortBreakData,
            backgroundColor: "hsl(142.1 76.2% 36.3%)",
            borderRadius: 3,
            barPercentage: 0.8,
          },
          {
            label: "Long Break",
            data: longBreakData,
            backgroundColor: "hsl(217.2 91.2% 59.8%)",
            borderRadius: 3,
            barPercentage: 0.8,
          },
        ],
      },
      options: {
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "bottom" as const },
          tooltip: {
            callbacks: {
              label: (ctx: { dataIndex: number; datasetIndex: number }) => {
                const interval = intervals[ctx.dataIndex];
                if (!interval) return "";
                const type = intervalTypeLabel(interval.interval_type);
                const start = formatTime(interval.start_time);
                const end = interval.end_time
                  ? formatTime(interval.end_time)
                  : "—";
                const dur = formatDuration(interval.duration_seconds);
                return `${type}: ${start} – ${end} (${dur})`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "time" as const,
            min: xMin,
            max: xMax,
            time: {
              unit: "hour" as const,
              displayFormats: { hour: "h a" },
            },
            ticks: { maxTicksLimit: 10 },
          },
          y: {
            display: false,
            stacked: true,
          },
        },
      },
    };
  }, [intervals, date]);

  if (!chartData) {
    return (
      <p className="text-sm text-muted-foreground">No intervals to display.</p>
    );
  }

  return (
    <div className="h-24" data-testid="daily-timeline">
      <Bar data={chartData} options={options} />
    </div>
  );
}
