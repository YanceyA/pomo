import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntervalSummary } from "@/lib/schemas";

vi.mock("chartjs-adapter-date-fns", () => ({}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  TimeScale: {},
  LinearScale: {},
  BarElement: {},
  Tooltip: {},
  Legend: {},
}));

vi.mock("react-chartjs-2", () => ({
  Bar: ({
    data,
  }: {
    data: { datasets: { label: string; data: unknown[] }[] };
  }) => (
    <div data-testid="mock-timeline-chart">
      {data.datasets.map((ds) => (
        <span key={ds.label} data-testid={`dataset-${ds.label}`}>
          {JSON.stringify(ds)}
        </span>
      ))}
    </div>
  ),
}));

const { DailyTimeline } = await import("../DailyTimeline");

const makeIntervals = (): IntervalSummary[] => [
  {
    id: 1,
    interval_type: "work",
    start_time: "2026-02-15T09:00:00Z",
    end_time: "2026-02-15T09:25:00Z",
    duration_seconds: 1500,
    planned_duration_seconds: 1500,
    status: "completed",
  },
  {
    id: 2,
    interval_type: "short_break",
    start_time: "2026-02-15T09:25:00Z",
    end_time: "2026-02-15T09:30:00Z",
    duration_seconds: 300,
    planned_duration_seconds: 300,
    status: "completed",
  },
  {
    id: 3,
    interval_type: "long_break",
    start_time: "2026-02-15T11:00:00Z",
    end_time: "2026-02-15T11:15:00Z",
    duration_seconds: 900,
    planned_duration_seconds: 900,
    status: "completed",
  },
];

describe("DailyTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders chart when intervals exist", () => {
    render(<DailyTimeline intervals={makeIntervals()} date="2026-02-15" />);
    expect(screen.getByTestId("mock-timeline-chart")).toBeInTheDocument();
  });

  it("shows empty state when no intervals", () => {
    render(<DailyTimeline intervals={[]} date="2026-02-15" />);
    expect(screen.getByText("No intervals to display.")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-timeline-chart")).not.toBeInTheDocument();
  });

  it("renders 3 datasets (work, short break, long break)", () => {
    render(<DailyTimeline intervals={makeIntervals()} date="2026-02-15" />);
    expect(screen.getByTestId("dataset-Focus")).toBeInTheDocument();
    expect(screen.getByTestId("dataset-Short Break")).toBeInTheDocument();
    expect(screen.getByTestId("dataset-Long Break")).toBeInTheDocument();
  });

  it("contains correct dataset labels", () => {
    render(<DailyTimeline intervals={makeIntervals()} date="2026-02-15" />);
    const ds0 = screen.getByTestId("dataset-Focus").textContent ?? "";
    const ds1 = screen.getByTestId("dataset-Short Break").textContent ?? "";
    const ds2 = screen.getByTestId("dataset-Long Break").textContent ?? "";
    expect(ds0).toContain('"Focus"');
    expect(ds1).toContain('"Short Break"');
    expect(ds2).toContain('"Long Break"');
  });

  it("renders with data-testid daily-timeline", () => {
    render(<DailyTimeline intervals={makeIntervals()} date="2026-02-15" />);
    expect(screen.getByTestId("daily-timeline")).toBeInTheDocument();
  });
});
