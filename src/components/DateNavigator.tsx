import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTaskStore } from "@/stores/taskStore";

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStringToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function dateToDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const date = dateStringToDate(dateStr);
  date.setDate(date.getDate() + days);
  return dateToDateString(date);
}

function formatDateHeader(dateStr: string): string {
  const today = todayString();
  if (dateStr === today) return "Today";

  const date = dateStringToDate(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DateNavigator() {
  const selectedDate = useTaskStore((s) => s.selectedDate);
  const setSelectedDate = useTaskStore((s) => s.setSelectedDate);

  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = todayString();
  const isToday = selectedDate === today;
  const isPast = selectedDate < today;

  const handlePrevDay = () => {
    setSelectedDate(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(dateToDateString(date));
      setCalendarOpen(false);
    }
  };

  const handleGoToToday = () => {
    setSelectedDate(today);
  };

  return (
    <div className="flex flex-col gap-2" data-testid="date-navigator">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handlePrevDay}
          data-testid="date-prev"
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 text-lg font-semibold"
              data-testid="date-header-button"
            >
              <CalendarIcon className="size-4" />
              <span data-testid="date-header-text">
                {formatDateHeader(selectedDate)}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateStringToDate(selectedDate)}
              onSelect={handleCalendarSelect}
              defaultMonth={dateStringToDate(selectedDate)}
              data-testid="date-calendar"
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={handleNextDay}
          data-testid="date-next"
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>

        {!isToday && (
          <Button
            variant="outline"
            size="sm"
            className="ml-2 h-7 text-xs"
            onClick={handleGoToToday}
            data-testid="date-today-button"
          >
            Today
          </Button>
        )}
      </div>

      {isPast && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="past-day-indicator"
        >
          Viewing a past day
        </p>
      )}
    </div>
  );
}
