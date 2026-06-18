import { formatTime } from "../timer/formatTime";

type PresetButtonsProps = {
  selectedDurationMs: number;
  focusPresets: number[];
  onSelect: (durationMs: number) => void;
  onDelete: (durationMs: number) => void;
};

export function PresetButtons({
  selectedDurationMs,
  focusPresets,
  onSelect,
  onDelete,
}: PresetButtonsProps) {
  return (
    <div className="preset-grid" aria-label="Timer presets">
      {focusPresets.map((durationMs) => (
        <div className="preset-item" key={durationMs}>
          <button
            className={`preset-button ${
              selectedDurationMs === durationMs ? "preset-button--active" : ""
            }`}
            type="button"
            onClick={() => onSelect(durationMs)}
          >
            {formatTime(durationMs)}
          </button>
          <button
            className="preset-delete"
            type="button"
            aria-label={`Delete ${formatTime(durationMs)} focus block`}
            title="Delete focus block"
            onClick={() => onDelete(durationMs)}
          >
            &times;
          </button>
        </div>
      ))}
      {focusPresets.length === 0 && (
        <p className="preset-empty">Add a focus block below.</p>
      )}
    </div>
  );
}
