/**
 * Physics & Engineering Types, Unit Constants and Validation Errors
 *
 * Provides SI conversion constants, unit conversion helpers, and structured
 * validation errors for deterministic engineering services.
 */

// ─── Physical Constants (SI) ──────────────────────────────────────────────────

/** Standard acceleration due to gravity in m/s² (ISO 80000-3 / BIPM) */
export const STANDARD_GRAVITY_M_S2 = 9.80665;

/** Square root of 3 for 3-phase electrical calculations */
export const SQRT_3 = Math.sqrt(3);

/** Floating point epsilon for deterministic tolerance checks */
export const EPSILON = 1e-9;

// ─── Validation Error ─────────────────────────────────────────────────────────

export class PhysicsValidationError extends Error {
  public readonly field?: string;
  public readonly receivedValue?: any;
  public readonly allowedConstraint?: string;

  constructor(message: string, details?: { field?: string; receivedValue?: any; allowedConstraint?: string }) {
    super(`[PhysicsValidationError] ${message}`);
    this.name = "PhysicsValidationError";
    this.field = details?.field;
    this.receivedValue = details?.receivedValue;
    this.allowedConstraint = details?.allowedConstraint;
    Object.setPrototypeOf(this, PhysicsValidationError.prototype);
  }
}

// ─── Unit Conversion Utilities ────────────────────────────────────────────────

export function assertFinitePositive(val: number, fieldName: string, allowZero = false): void {
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new PhysicsValidationError(`${fieldName} must be a finite number. Received: ${val}`, {
      field: fieldName,
      receivedValue: val,
      allowedConstraint: "Number.isFinite(val) === true",
    });
  }
  if (allowZero) {
    if (val < 0) {
      throw new PhysicsValidationError(`${fieldName} must be non-negative (>= 0). Received: ${val}`, {
        field: fieldName,
        receivedValue: val,
        allowedConstraint: "val >= 0",
      });
    }
  } else {
    if (val <= 0) {
      throw new PhysicsValidationError(`${fieldName} must be strictly positive (> 0). Received: ${val}`, {
        field: fieldName,
        receivedValue: val,
        allowedConstraint: "val > 0",
      });
    }
  }
}

export function assertPowerFactorValid(pf: number, fieldName = "powerFactor"): void {
  if (typeof pf !== "number" || !Number.isFinite(pf)) {
    throw new PhysicsValidationError(`${fieldName} must be a finite number. Received: ${pf}`, {
      field: fieldName,
      receivedValue: pf,
      allowedConstraint: "Number.isFinite(val) === true",
    });
  }
  if (pf <= 0 || pf > 1.0) {
    throw new PhysicsValidationError(
      `${fieldName} must be in the open-closed interval (0, 1.0]. A power factor <= 0 or > 1.0 is physically impossible for linear AC loads. Received: ${pf}`,
      {
        field: fieldName,
        receivedValue: pf,
        allowedConstraint: "0 < pf <= 1.0",
      }
    );
  }
}

export function kilowattsToWatts(kW: number): number {
  assertFinitePositive(kW, "kW", true);
  return kW * 1000;
}

export function wattsToKilowatts(W: number): number {
  assertFinitePositive(W, "W", true);
  return W / 1000;
}

export function kilovoltAmperesToVoltAmperes(kVA: number): number {
  assertFinitePositive(kVA, "kVA", true);
  return kVA * 1000;
}

export function voltAmperesToKilovoltAmperes(VA: number): number {
  assertFinitePositive(VA, "VA", true);
  return VA / 1000;
}

export function kilogramsToNewtons(massKg: number, g: number = STANDARD_GRAVITY_M_S2): number {
  assertFinitePositive(massKg, "massKg", true);
  assertFinitePositive(g, "gravity_g", false);
  return massKg * g;
}

export function newtonsToKilograms(forceN: number, g: number = STANDARD_GRAVITY_M_S2): number {
  assertFinitePositive(forceN, "forceN", true);
  assertFinitePositive(g, "gravity_g", false);
  return forceN / g;
}
