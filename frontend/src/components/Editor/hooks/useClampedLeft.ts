import { useLayoutEffect, useRef } from "react";

/**
 * Places a floating box at `left` px, shifted left as needed so it never spills
 * past its positioned parent's right edge (e.g. a selection at the end of a
 * line). Runs after every render because the box's width changes with its
 * content (loading → diff → refine).
 */
export function useClampedLeft<T extends HTMLElement>(left: number) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    const parent = element?.offsetParent;
    if (!element || !(parent instanceof HTMLElement)) return;
    const maxLeft = parent.clientWidth - element.offsetWidth;
    element.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
  });

  return ref;
}
