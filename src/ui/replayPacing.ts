export const REPLAY_SIGNAL_DWELL_MS = 3600;
export const REPLAY_QUIET_DWELL_MS = 1200;
export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;

export type ReplayPacingTurn = {
  sceneEvents?: unknown[];
  moments?: unknown[];
  protocolEvidence?: {
    aliasProbes?: unknown[];
    institutionEvents?: unknown[];
    lexiconEvents?: unknown[];
  };
};

export type ReplayPacingOptions = {
  signalDwellMs?: number;
  quietDwellMs?: number;
};

export function hasReplayNarrativeSignal(turn: ReplayPacingTurn): boolean {
  const protocol = turn.protocolEvidence || {};
  return (turn.sceneEvents?.length || 0) > 0 ||
    (turn.moments?.length || 0) > 0 ||
    (protocol.aliasProbes?.length || 0) > 0 ||
    (protocol.institutionEvents?.length || 0) > 0 ||
    (protocol.lexiconEvents?.length || 0) > 0;
}

export function replayTurnDwellMs(turn: ReplayPacingTurn, playbackRate = 1, options: ReplayPacingOptions = {}): number {
  const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  const signalDwellMs = positiveDuration(options.signalDwellMs, REPLAY_SIGNAL_DWELL_MS);
  const quietDwellMs = positiveDuration(options.quietDwellMs, REPLAY_QUIET_DWELL_MS);
  const baseDwell = hasReplayNarrativeSignal(turn) ? signalDwellMs : quietDwellMs;
  return Math.max(250, Math.round(baseDwell / rate));
}

export function replayDurationMs(turns: ReplayPacingTurn[], playbackRate = 1, options: ReplayPacingOptions = {}): number {
  return turns.reduce((total, turn) => total + replayTurnDwellMs(turn, playbackRate, options), 0);
}

function positiveDuration(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}
