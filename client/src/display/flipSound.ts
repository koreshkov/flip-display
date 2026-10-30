import { useCallback, useEffect, useRef, useState } from "react";

const storageKey = "flip-display:sound";
// Clicks started per frame at most; more landings make them louder instead.
const maxVoices = 3;
const volume = 0.3;

type Audio = {
  context: AudioContext;
  noise: AudioBuffer;
  output: AudioNode;
};

function createAudio(): Audio {
  const context = new AudioContext();
  const noise = context.createBuffer(
    1,
    context.sampleRate / 2,
    context.sampleRate,
  );
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // Keeps a whole board landing at once from clipping.
  const output = context.createDynamicsCompressor();
  output.connect(context.destination);
  return { context, noise, output };
}

// One flap hitting the stop: a bright plastic clack over a short low tock.
function playClick(
  { context, noise, output }: Audio,
  time: number,
  gain: number,
) {
  const length = 0.025 + Math.random() * 0.02;
  const panner = new StereoPannerNode(context, {
    pan: Math.random() * 0.6 - 0.3,
  });
  panner.connect(output);

  const clack = new AudioBufferSourceNode(context, { buffer: noise });
  const filter = new BiquadFilterNode(context, {
    type: "bandpass",
    frequency: 1800 + Math.random() * 2200,
    Q: 1.2,
  });
  const clackGain = new GainNode(context, { gain: 0 });
  clackGain.gain.setValueAtTime(0, time);
  clackGain.gain.linearRampToValueAtTime(gain, time + 0.001);
  clackGain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  clack.connect(filter).connect(clackGain).connect(panner);
  clack.start(time, Math.random() * 0.4, length);

  const tock = new OscillatorNode(context, {
    type: "triangle",
    frequency: 180 + Math.random() * 80,
  });
  const tockGain = new GainNode(context, { gain: 0 });
  tockGain.gain.setValueAtTime(0, time);
  tockGain.gain.linearRampToValueAtTime(gain * 0.4, time + 0.001);
  tockGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
  tock.connect(tockGain).connect(panner);
  tock.start(time);
  tock.stop(time + 0.03);
}

// Sound of the flaps landing, switched on per browser. Browsers only let
// audio start after a click or key press, so a remembered "on" waits for one.
export function useFlipSound() {
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<Audio | null>(null);
  const playing = useRef(false);

  const start = useCallback(() => {
    audio.current ??= createAudio();
    void audio.current.context.resume();
  }, []);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(storageKey) === "on";
    } catch {}
    if (!stored) return;
    setEnabled(true);
    const events = ["pointerdown", "keydown"] as const;
    const startOnce = () => {
      start();
      events.forEach((event) => window.removeEventListener(event, startOnce));
    };
    events.forEach((event) => window.addEventListener(event, startOnce));
    return () =>
      events.forEach((event) => window.removeEventListener(event, startOnce));
  }, [start]);

  useEffect(() => {
    playing.current = enabled;
  }, [enabled]);

  useEffect(() => () => void audio.current?.context.close(), []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(storageKey, next ? "on" : "off");
    } catch {}
    if (next) start();
    else void audio.current?.context.suspend();
  }, [enabled, start]);

  // `count` flaps landed during the last frame, `delta` seconds long.
  const play = useCallback((count: number, delta: number) => {
    const current = audio.current;
    if (!playing.current || current?.context.state !== "running") return;
    const voices = Math.min(count, maxVoices);
    const gain = (volume * Math.sqrt(Math.min(count, 30))) / voices;
    for (let i = 0; i < voices; i++) {
      // Spread over the frame, so the clicks don't buzz at the frame rate.
      const time = current.context.currentTime + Math.random() * delta;
      playClick(current, time, gain);
    }
  }, []);

  return { enabled, toggle, play };
}
