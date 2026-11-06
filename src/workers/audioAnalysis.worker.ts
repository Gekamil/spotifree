/// <reference lib="webworker" />
import { analyzeAudio } from '../utils/audioAnalysis';

// Runs the BPM / key / structure analysis off the main thread.
self.onmessage = (e: MessageEvent<{ reqId: number; channels: Float32Array[]; sampleRate: number }>) => {
  const { reqId, channels, sampleRate } = e.data;
  try {
    const result = analyzeAudio(channels, sampleRate);
    (self as unknown as Worker).postMessage({ reqId, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ reqId, error: String(err) });
  }
};
