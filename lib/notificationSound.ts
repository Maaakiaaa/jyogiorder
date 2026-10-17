const NOTIFICATION_SOUND_PATH = "/Bell.mp3";

export function createNotificationAudio(): HTMLAudioElement {
  const audio = new Audio(NOTIFICATION_SOUND_PATH);
  audio.preload = "auto";
  return audio;
}

export async function unlockNotificationAudio(audio: HTMLAudioElement): Promise<void> {
  audio.currentTime = 0;
  try {
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Browser autoplay policies or an unavailable audio file must not break the screen.
  }
}

export function playNotificationAudio(audio: HTMLAudioElement): void {
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Audio playback is best effort only.
  });
}
