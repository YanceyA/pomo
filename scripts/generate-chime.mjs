// Generate a pleasant bell/chime WAV file for the pomodoro timer alarm.
// Run: node scripts/generate-chime.mjs
import { mkdirSync, writeFileSync } from "fs";

const SAMPLE_RATE = 44100;
const DURATION = 0.8;
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

// Generate PCM data: two-tone bell with harmonics and exponential decay
const samples = new Int16Array(NUM_SAMPLES);
for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  const envelope = Math.exp(-t / 0.2);
  // Slight shimmer: frequency sweep at attack
  const sweep = 1 + 0.008 * Math.exp(-t / 0.03);
  const tone1 = Math.sin(2 * Math.PI * 880 * sweep * t); // A5
  const tone2 = Math.sin(2 * Math.PI * 1318.5 * sweep * t) * 0.4; // E6
  const tone3 = Math.sin(2 * Math.PI * 1760 * t) * 0.15 * Math.exp(-t / 0.1); // A6 (short shimmer)
  const sample = (tone1 + tone2 + tone3) * envelope * 0.6;
  samples[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
}

// Build WAV file
const dataSize = NUM_SAMPLES * 2;
const buffer = Buffer.alloc(44 + dataSize);

buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(1, 22); // mono
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < NUM_SAMPLES; i++) {
  buffer.writeInt16LE(samples[i], 44 + i * 2);
}

mkdirSync("public/sounds", { recursive: true });
writeFileSync("public/sounds/chime.wav", buffer);
console.log(
  `Generated chime.wav: ${buffer.length} bytes, ${DURATION}s, ${SAMPLE_RATE}Hz`,
);
