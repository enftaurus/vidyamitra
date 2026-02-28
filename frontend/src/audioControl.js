export const stopAllAudioPlayback = () => {
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // no-op
  }

  try {
    const mediaElements = document.querySelectorAll('audio, video');
    mediaElements.forEach((element) => {
      try {
        element.pause();
      } catch {
        // no-op
      }
    });
  } catch {
    // no-op
  }
};
