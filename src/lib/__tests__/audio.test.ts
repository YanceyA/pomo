import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Tauri invoke ─────────────────────────────────────────
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ── Mock HTMLAudioElement ─────────────────────────────────────
interface MockAudioInstance {
  volume: number;
  play: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  src: string;
}

let audioInstances: MockAudioInstance[] = [];

function createMockAudio(src: string): MockAudioInstance {
  const handlers: Record<string, (() => void)[]> = {};
  const instance: MockAudioInstance = {
    src,
    volume: 1,
    play: vi.fn().mockImplementation(() => {
      // Simulate successful playback — fire "ended" asynchronously
      setTimeout(() => {
        for (const cb of handlers.ended ?? []) cb();
      }, 0);
      return Promise.resolve();
    }),
    addEventListener: vi
      .fn()
      .mockImplementation((event: string, cb: () => void) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(cb);
      }),
  };
  audioInstances.push(instance);
  return instance;
}

const MockAudio = vi.fn().mockImplementation(createMockAudio);
vi.stubGlobal("Audio", MockAudio);

const { playAlarmChime } = await import("../audio");

describe("audio", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    audioInstances = [];
    // Re-apply the default mock implementation (clearAllMocks would remove it)
    MockAudio.mockReset().mockImplementation(createMockAudio);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays chime via web audio with correct volume", async () => {
    const promise = playAlarmChime(0.8, 1);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(MockAudio).toHaveBeenCalledWith("/sounds/chime.wav");
    expect(audioInstances[0].volume).toBe(0.8);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it("plays multiple repetitions with gaps", async () => {
    const promise = playAlarmChime(0.5, 2);

    // First chime plays and ends
    await vi.advanceTimersByTimeAsync(100);
    expect(audioInstances).toHaveLength(1);

    // Wait for the 1-second gap
    await vi.advanceTimersByTimeAsync(1000);

    // Second chime plays
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].volume).toBe(0.5);
    expect(audioInstances[1].volume).toBe(0.5);
  });

  it("clamps volume to 0-1 range", async () => {
    const promise = playAlarmChime(1.5, 1);
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(audioInstances[0].volume).toBe(1);
  });

  it("falls back to Rust backend when web audio fails", async () => {
    MockAudio.mockImplementationOnce(() => {
      throw new Error("Audio not supported");
    });

    mockInvoke.mockResolvedValue(undefined);

    await playAlarmChime(0.7, 3);

    expect(mockInvoke).toHaveBeenCalledWith("play_alarm", {
      volume: 0.7,
      repetitions: 3,
    });
  });

  it("falls back when audio.play() rejects", async () => {
    MockAudio.mockImplementationOnce((src: string) => ({
      src,
      volume: 1,
      addEventListener: vi.fn(),
      play: vi.fn().mockRejectedValue(new Error("Autoplay blocked")),
    }));

    mockInvoke.mockResolvedValue(undefined);

    await playAlarmChime(0.6, 1);

    expect(mockInvoke).toHaveBeenCalledWith("play_alarm", {
      volume: 0.6,
      repetitions: 1,
    });
  });
});
