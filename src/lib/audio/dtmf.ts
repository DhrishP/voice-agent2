import { type AudioFormat } from "./format";
const alawmulaw = require("alawmulaw");

export const dtmfFrequencies = {
  "1": [697, 1209],
  "2": [697, 1336],
  "3": [697, 1477],
  "4": [770, 1209],
  "5": [770, 1336],
  "6": [770, 1477],
  "7": [852, 1209],
  "8": [852, 1336],
  "9": [852, 1477],
  "*": [941, 1209],
  "0": [941, 1336],
  "#": [941, 1477],
  A: [697, 1633],
  B: [770, 1633],
  C: [852, 1633],
  D: [941, 1633],
} as const;

export type DTMFTone = keyof typeof dtmfFrequencies;

export function generateDTMFTone(args: {
  tone: DTMFTone;
  durationMs: number;
  audioFormat: AudioFormat;
}) {
  console.log(`[DTMF Generator] Generating tone for ${args.tone}`);
  console.log(
    `[DTMF Generator] Duration: ${args.durationMs}ms, Sample rate: ${args.audioFormat.sampleRate}Hz`
  );

  const frequencies = dtmfFrequencies[args.tone];
  const numSamples = (args.durationMs * args.audioFormat.sampleRate) / 1000;

  console.log(
    `[DTMF Generator] Using frequencies: ${frequencies[0]}Hz and ${frequencies[1]}Hz`
  );
  console.log(`[DTMF Generator] Generating ${numSamples} samples`);

  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const time = i / args.audioFormat.sampleRate;
    const sample =
      Math.sin(2 * Math.PI * frequencies[0] * time) +
      Math.sin(2 * Math.PI * frequencies[1] * time);
    samples[i] = sample * 0.5; // Mix at 50% volume to prevent clipping
  }

  // Convert float samples to Int16Array first
  const pcmSamples = new Int16Array(
    samples.map((s) => Math.max(-32768, Math.min(32767, s * 32767)))
  );

  let buffer: Buffer;
  if (args.audioFormat.format === "pcm_s16le") {
    buffer = Buffer.from(pcmSamples.buffer);
  } else if (args.audioFormat.format === "mulaw") {
    try {
      console.log(
        `[DTMF Generator] Encoding ${pcmSamples.length} samples to μ-law`
      );
      const mulawData = alawmulaw.mulaw.encode(pcmSamples);
      buffer = Buffer.from(mulawData.buffer);
      console.log(
        `[DTMF Generator] Successfully encoded to μ-law, result length: ${buffer.length}`
      );
    } catch (error) {
      console.error(`[DTMF Generator] Error encoding to μ-law:`, error);
      // Fallback to PCM
      buffer = Buffer.from(pcmSamples.buffer);
    }
  } else {
    buffer = Buffer.from(
      new Uint8Array(
        samples.map((s) => Math.max(0, Math.min(255, (s + 1) * 127.5)))
      ).buffer
    );
  }

  console.log(
    `[DTMF Generator] Generated buffer size: ${buffer.length} bytes for format ${args.audioFormat.format}`
  );
  return buffer;
}

export function generateDTMFSequence(args: {
  sequence: DTMFTone[];
  toneDurationMs: number;
  pauseDurationMs: number;
  audioFormat: AudioFormat;
}) {
  console.log(
    `[DTMF Sequence] Generating sequence for ${args.sequence.join("")}`
  );
  console.log(
    `[DTMF Sequence] Tone duration: ${args.toneDurationMs}ms, Pause duration: ${args.pauseDurationMs}ms`
  );

  const totalSamples = args.sequence.reduce(
    (acc, _) =>
      acc +
      Math.round((args.toneDurationMs * args.audioFormat.sampleRate) / 1000) +
      Math.round((args.pauseDurationMs * args.audioFormat.sampleRate) / 1000),
    0
  );

  console.log(`[DTMF Sequence] Total samples to generate: ${totalSamples}`);

  // Always generate as PCM first
  const samples = new Int16Array(totalSamples);
  let offset = 0;

  for (const tone of args.sequence) {
    console.log(`[DTMF Sequence] Processing tone: ${tone}`);

    const toneBuffer = generateDTMFTone({
      tone,
      durationMs: args.toneDurationMs,
      audioFormat: { ...args.audioFormat, format: "pcm_s16le" }, // Generate as PCM first
    });

    const toneSamples = new Int16Array(
      toneBuffer.buffer,
      toneBuffer.byteOffset,
      toneBuffer.length / 2
    );

    samples.set(toneSamples, offset);
    offset += toneSamples.length;

    const pauseSamples = Math.round(
      (args.pauseDurationMs * args.audioFormat.sampleRate) / 1000
    );
    samples.fill(0, offset, offset + pauseSamples);
    offset += pauseSamples;

    console.log(
      `[DTMF Sequence] Added tone ${tone} with ${toneSamples.length} samples and ${pauseSamples} pause samples`
    );
  }

  let finalBuffer: Buffer;
  if (args.audioFormat.format === "mulaw") {
    try {
      console.log(`[DTMF Sequence] Encoding complete sequence to μ-law`);
      const mulawData = alawmulaw.mulaw.encode(samples);
      finalBuffer = Buffer.from(mulawData.buffer);
      console.log(
        `[DTMF Sequence] Successfully encoded sequence to μ-law, result length: ${finalBuffer.length}`
      );
    } catch (error) {
      console.error(`[DTMF Sequence] Error encoding sequence to μ-law:`, error);
      // Fallback to PCM
      finalBuffer = Buffer.from(samples.buffer);
    }
  } else {
    finalBuffer = Buffer.from(samples.buffer);
  }

  console.log(`[DTMF Sequence] Final buffer size: ${finalBuffer.length} bytes`);
  return finalBuffer;
}
