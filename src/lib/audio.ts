import { invoke } from "@tauri-apps/api/core";

/**
 * Play the alarm chime using Web Audio API.
 * Falls back to Rust rodio backend if web audio fails.
 */
export async function playAlarmChime(
  volume: number,
  repetitions = 3,
): Promise<void> {
  try {
    await playChimeSequenceWebAudio(volume, repetitions);
  } catch {
    // Fallback to Rust backend (works even if webview audio is blocked)
    await invoke("play_alarm", { volume, repetitions });
  }
}

async function playChimeSequenceWebAudio(
  volume: number,
  repetitions: number,
): Promise<void> {
  for (let i = 0; i < repetitions; i++) {
    await playChimeTone(volume);
    if (i < repetitions - 1) {
      await delay(1000);
    }
  }
}

function playChimeTone(volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio("/sounds/chime.wav");
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.addEventListener("ended", () => resolve());
      audio.addEventListener("error", () =>
        reject(new Error("Audio playback failed")),
      );
      audio.play().catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
