const releaseGraceMs = 250;

export class AltGrGuard {
  private rightAltDown = false;
  private blockedUntil = 0;

  update(down: boolean, now = Date.now()): void {
    if (down) {
      this.rightAltDown = true;
      return;
    }

    if (this.rightAltDown) {
      this.blockedUntil = now + releaseGraceMs;
    }
    this.rightAltDown = false;
  }

  allowsShortcut(now = Date.now()): boolean {
    return !this.rightAltDown && now >= this.blockedUntil;
  }
}
