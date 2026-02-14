import { Button } from "@/components/ui/button";

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Pomo</h1>
      <p className="text-muted-foreground">
        A focused pomodoro timer for your workday.
      </p>
      <Button size="lg">Start Timer</Button>
    </main>
  );
}

export default App;
