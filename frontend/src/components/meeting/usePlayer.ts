"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Player = ReturnType<typeof usePlayer>;

/**
 * Playback state for a meeting. With a recording, attach the <audio>/<video> element via
 * `attachMedia` and it drives time. Transcript-only meetings have no media, so time advances
 * on a clock over [0, fallbackDuration] instead — same API either way.
 */
export function usePlayer(fallbackDuration: number) {
  const [media, setMedia] = useState<HTMLMediaElement | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const timeRef = useRef(0);
  const stopAt = useRef<number | null>(null); // end of the soundbite being played, if any
  const duration = mediaDuration ?? fallbackDuration;

  // Mirror the media element's own state (it can also be paused by the browser, end, etc.).
  useEffect(() => {
    if (!media) return;
    const sync = () => { timeRef.current = media.currentTime; setTime(media.currentTime); };
    const onMeta = () => { if (Number.isFinite(media.duration)) setMediaDuration(media.duration); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const events: [string, () => void][] = [
      ["play", onPlay], ["pause", onPause], ["ended", onPause],
      ["loadedmetadata", onMeta], ["timeupdate", sync], ["seeked", sync],
    ];
    events.forEach(([e, fn]) => media.addEventListener(e, fn));
    onMeta();
    return () => events.forEach(([e, fn]) => media.removeEventListener(e, fn));
  }, [media]);

  // While playing, update every frame so the transcript highlight moves smoothly
  // (media 'timeupdate' only fires ~4 times a second).
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      if (media) {
        timeRef.current = media.currentTime;
      } else {
        timeRef.current = Math.min(duration, timeRef.current + ((now - last) / 1000) * rate);
        if (timeRef.current >= duration) setPlaying(false);
      }
      last = now;
      setTime(timeRef.current);
      if (stopAt.current != null && timeRef.current >= stopAt.current) {
        stopAt.current = null;
        if (media) media.pause();
        else setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, rate, duration, media]);

  const seek = useCallback((t: number) => {
    stopAt.current = null; // a manual seek cancels soundbite playback bounds
    const next = Math.max(0, Math.min(duration, t));
    timeRef.current = next;
    if (media) media.currentTime = next;
    setTime(next);
  }, [duration, media]);

  const toggle = useCallback(() => {
    if (timeRef.current >= duration - 0.05) seek(0); // replay from the start after the end
    if (media) {
      if (media.paused) media.play().catch(() => setPlaying(false));
      else media.pause();
    } else {
      setPlaying((p) => !p);
    }
  }, [duration, media, seek]);

  /** Play just [start, end] — used for soundbites. */
  const playRange = useCallback((start: number, end: number) => {
    seek(start);
    stopAt.current = end;
    if (media) media.play().catch(() => setPlaying(false));
    else setPlaying(true);
  }, [media, seek]);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    if (media) media.playbackRate = r;
  }, [media]);

  return { time, playing, rate, duration, seek, toggle, playRange, setRate, attachMedia: setMedia };
}
