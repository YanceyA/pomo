import { DailySummary } from "@/components/DailySummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklySummary } from "@/components/WeeklySummary";
import { useReportStore } from "@/stores/reportStore";

export function ReportsPage() {
  const activeTab = useReportStore((s) => s.activeTab);
  const setActiveTab = useReportStore((s) => s.setActiveTab);

  return (
    <div className="w-full max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold">Reports</h2>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "daily" | "weekly")}
      >
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <DailySummary />
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklySummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
