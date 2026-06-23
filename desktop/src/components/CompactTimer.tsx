import { useRef } from "react";
import { electronApi } from "../desktop/electronApi";
import { formatTime } from "../timer/formatTime";
import type { TimerState } from "../timer/timerTypes";

type CompactTimerProps = {
  timer: TimerState;
  onExitCompact: () => void;
};

export function CompactTimer({ timer, onExitCompact }: CompactTimerProps) {
  const dragPosition = useRef<{ screenX: number; screenY: number } | null>(null);

  const stopDrag = () => {
    dragPosition.current = null;
  };

  return (
    <main
      className="compact-layout"
      onDoubleClick={(event) => {
        event.preventDefault();
        stopDrag();
        onExitCompact();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        dragPosition.current = {
          screenX: event.screenX,
          screenY: event.screenY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragPosition.current) {
          return;
        }

        const deltaX = event.screenX - dragPosition.current.screenX;
        const deltaY = event.screenY - dragPosition.current.screenY;
        dragPosition.current = {
          screenX: event.screenX,
          screenY: event.screenY,
        };

        if (deltaX !== 0 || deltaY !== 0) {
          electronApi.moveCompactWindowBy(deltaX, deltaY);
        }
      }}
      onPointerUp={(event) => {
        stopDrag();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={stopDrag}
    >
      <strong className="compact-time">{formatTime(timer.remainingMs)}</strong>
    </main>
  );
}
