import { electronApi } from "../desktop/electronApi";

type WindowChromeProps = {
  compact: boolean;
};

export function WindowChrome({ compact }: WindowChromeProps) {
  return (
    <header className={`window-chrome ${compact ? "window-chrome--compact" : ""}`}>
      <div className="window-brand">
        <span className="window-brand__mark" />
        {!compact && <span>Focus Timer</span>}
      </div>
      <div className="window-actions">
        <button
          className="window-button"
          type="button"
          aria-label="Minimize"
          onClick={electronApi.minimizeWindow}
        >
          <span className="minimize-mark" />
        </button>
        <button
          className="window-button window-button--close"
          type="button"
          aria-label="Close"
          onClick={electronApi.closeWindow}
        >
          <span className="close-mark" />
        </button>
      </div>
    </header>
  );
}
