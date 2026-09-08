"use client";

import { useEffect, useRef, useState } from "react";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event) => setReduced(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  return reduced;
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

// Counts up from 0 to `value` once, the first time a real (non-zero) value
// arrives after loading — never re-triggers on later re-renders with the
// same value, and never animates a zero (an empty stat should just read
// "0" cleanly, not sweep up to it). Visually the number animates, but the
// accessible name is always the final value, so screen readers never read
// out a stream of changing intermediate numbers.
export default function AnimatedNumber({ value, format, duration = 900 }) {
  const reducedMotion = usePrefersReducedMotion();
  const hasAnimated = useRef(false);
  const numericValue = Number(value) || 0;
  const [display, setDisplay] = useState(reducedMotion || !numericValue ? numericValue : 0);

  useEffect(() => {
    if (hasAnimated.current || reducedMotion || !numericValue) {
      setDisplay(numericValue);
      hasAnimated.current = true;
      return undefined;
    }
    hasAnimated.current = true;
    let frameId;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(numericValue * easeOutCubic(progress)));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericValue]);

  const formatted = format ? format(display) : display.toLocaleString();
  const finalFormatted = format ? format(numericValue) : numericValue.toLocaleString();

  return <span aria-label={finalFormatted}>{formatted}</span>;
}
