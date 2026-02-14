import { TaskList } from "@/components/TaskList";
import { TimerPage } from "@/components/TimerPage";

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-8">
      <TimerPage />
      <TaskList />
    </main>
  );
}

export default App;
