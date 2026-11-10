export type Exercise = 'squat' | 'jack' | 'raise';

/** Short coaching lines shown after a shallow rep. */
export type Tip = 'lower' | 'knees' | 'arms-higher' | 'feet-wider' | 'reach-higher' | 'straight-arms';

/**
 * The user's own range of motion, measured from one slow rep ("movement check").
 * Values are the deepest/highest point reached; see metrics.ts for units.
 */
export type Calibration = {
  /** Squat, feet in view: lowest hip→ankle height as a share of standing (e.g. 0.62). */
  squatDepth?: number;
  /** Squat, upper body only: how far the hips drop, in shoulder widths (e.g. 0.9). */
  squatDrop?: number;
  /** Jumping jack: widest feet spread (× shoulder width) and highest hands (× torso, above shoulders). */
  jackSpread?: number;
  jackArms?: number;
  /** Arm raise: highest hands (× torso, above shoulders). */
  raiseArms?: number;
};
