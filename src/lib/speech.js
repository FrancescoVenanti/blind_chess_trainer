// Speaking moves out loud is the closest thing to a real blindfold game, where
// someone calls the moves to you. Every call degrades to a no-op when the
// browser has no speech synthesis (or the user has it switched off).

import { describeSan } from './notation.js';

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, { enabled = true, rate = 0.95 } = {}) {
  if (!enabled || !text || !speechSupported()) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel(); // don't queue up behind a stale announcement
    window.speechSynthesis.speak(utterance);
  } catch {
    // A browser that throws here simply doesn't get spoken moves.
  }
}

export function speakSan(san, options) {
  speak(describeSan(san), options);
}

export function stopSpeaking() {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to cancel */
  }
}
