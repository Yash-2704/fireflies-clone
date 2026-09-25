"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Player = ReturnType<typeof usePlayer>;

/**
 * Playback clock for the meeting timeline. Meetings are created from transcripts (no media),
 * so time advances on requestAnimationFrame over [0, duration] — the brief allows a
 * placeholder player. Swap the clock for an <audio> element's currentTime if recordings are added.
 */
export function usePlayer(duration: number) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const next = Math.min(duration, timeRef.current + ((now - last) / 1000) * rate);
      last = now;
      timeRef.current = next;
      setTime(next);
      if (next >= duration) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, rate, duration]);

  const seek = useCallback((t: number) => {
    timeRef.current = Math.max(0, Math.min(duration, t));
    setTime(timeRef.current);
  }, [duration]);

  const toggle = useCallback(() => {
    if (timeRef.current >= duration) seek(0); // replay from start after the end
    setPlaying((p) => !p);
  }, [duration, seek]);

  return { time, playing, rate, duration, seek, toggle, setRate, play: () => setPlaying(true) };
}
