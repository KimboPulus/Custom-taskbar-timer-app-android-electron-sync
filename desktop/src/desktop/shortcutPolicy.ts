const controlModifiers = new Set(["control", "ctrl", "commandorcontrol", "cmdorctrl"]);

export function requiresAltGrGuard(accelerator: string): boolean {
  const tokens = accelerator
    .split("+")
    .map((token) => token.trim().toLowerCase());

  return tokens.includes("alt") && tokens.some((token) => controlModifiers.has(token));
}
