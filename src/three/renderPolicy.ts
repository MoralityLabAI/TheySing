export type ObservatoryRenderPolicyInput = {
  reducedMotion: boolean;
  coarsePointer: boolean;
  presentationActive: boolean;
};

export type ObservatoryRenderPolicy = {
  maxPixelRatio: number;
  targetFps: number;
  ambientMotion: boolean;
};

export function deriveObservatoryRenderPolicy(input: ObservatoryRenderPolicyInput): ObservatoryRenderPolicy {
  if (input.reducedMotion) {
    return { maxPixelRatio: 1.25, targetFps: 12, ambientMotion: false };
  }
  if (!input.presentationActive) {
    return { maxPixelRatio: input.coarsePointer ? 1.5 : 2, targetFps: 15, ambientMotion: true };
  }
  if (input.coarsePointer) {
    return { maxPixelRatio: 1.5, targetFps: 30, ambientMotion: true };
  }
  return { maxPixelRatio: 2, targetFps: 60, ambientMotion: true };
}
