/**
 * Loads the audio-capture-processor AudioWorklet as an inline Blob URL.
 * This avoids dependency on the hosting server serving the .js file from root,
 * which fails on some Amplify static hosting configurations.
 */

const WORKLET_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._active = true;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') this._active = false;
    };
  }

  process(inputs) {
    if (!this._active) return false;
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

let cachedUrl: string | null = null;

/**
 * Returns a Blob URL for the audio-capture-processor worklet.
 * The URL is cached and reused across calls.
 */
export function getAudioWorkletUrl(): string {
    if (!cachedUrl) {
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
        cachedUrl = URL.createObjectURL(blob);
    }
    return cachedUrl;
}
