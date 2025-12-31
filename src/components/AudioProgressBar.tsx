"use client";

type AudioProgressBarProps = {
  progress: number; // 0-100
};

export function AudioProgressBar({ progress }: AudioProgressBarProps) {
  const clamped = Number.isFinite(progress)
    ? Math.min(100, Math.max(0, progress))
    : 0;

  return (
    <div
      className="pointer-events-none h-1 w-full bg-secondary"
      aria-hidden="true"
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-linear"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
