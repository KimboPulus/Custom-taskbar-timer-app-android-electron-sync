import { electronApi } from "./electronApi";
import type { AlarmSound } from "./desktopTypes";

let activeMedia: HTMLMediaElement | null = null;
let activeContext: AudioContext | null = null;
let stopTimer: number | null = null;

export function stopAlarm(): void {
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }

  if (activeMedia) {
    activeMedia.pause();
    activeMedia.removeAttribute("src");
    activeMedia.load();
    activeMedia.remove();
    activeMedia = null;
  }

  if (activeContext) {
    void activeContext.close();
    activeContext = null;
  }
}

function playGentleChime(volume: number): void {
  const context = new AudioContext();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, volume * 0.35),
    context.currentTime + 0.03,
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.4);
  gain.connect(context.destination);

  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.18);
    oscillator.stop(context.currentTime + 2.5);
  });

  activeContext = context;
  stopTimer = window.setTimeout(stopAlarm, 3_000);
}

export async function playAlarm(
  sound: AlarmSound,
  volume: number,
): Promise<boolean> {
  stopAlarm();
  const normalizedVolume = Math.min(1, Math.max(0, volume));

  if (sound.kind === "built-in") {
    playGentleChime(normalizedVolume);
    return true;
  }

  const url = await electronApi.resolveAlarmUrl(sound);
  if (!url) {
    return false;
  }

  const media = document.createElement(
    sound.kind === "custom" && /\.mp4$/i.test(sound.source)
      ? "video"
      : "audio",
  );
  media.src = url;
  media.volume = normalizedVolume;
  media.preload = "auto";
  media.style.display = "none";
  media.addEventListener("ended", stopAlarm, { once: true });
  document.body.append(media);
  activeMedia = media;

  try {
    await media.play();
    stopTimer = window.setTimeout(stopAlarm, 30_000);
    return true;
  } catch (error) {
    console.warn("Could not play alarm media:", error);
    stopAlarm();
    return false;
  }
}
