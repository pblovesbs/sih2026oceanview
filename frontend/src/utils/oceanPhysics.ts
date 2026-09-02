/**
 * oceanPhysics.ts
 * Seawater Equation of State (EOS) and Water Mass Classification utilities.
 */

// UNESCO 1983 / Millero & Poisson simplified potential density formula (1 atm)
export function computePotentialDensity(temp: number, salinity: number): number {
  // Pure water density
  const rhow =
    999.842594 +
    6.793952e-2 * temp -
    9.09529e-3 * Math.pow(temp, 2) +
    1.001685e-4 * Math.pow(temp, 3) -
    1.120083e-6 * Math.pow(temp, 4) +
    6.536332e-9 * Math.pow(temp, 5);

  const A =
    8.24493e-1 -
    4.0899e-3 * temp +
    7.6438e-5 * Math.pow(temp, 2) -
    8.2467e-7 * Math.pow(temp, 3) +
    5.3875e-9 * Math.pow(temp, 4);

  const B =
    -5.72466e-3 +
    1.0227e-4 * temp -
    1.6546e-6 * Math.pow(temp, 2);

  const C = 4.8314e-4;

  const rho = rhow + A * salinity + B * Math.pow(salinity, 1.5) + C * Math.pow(salinity, 2);
  return rho;
}

export function computeSigmaTheta(temp: number, salinity: number): number {
  return computePotentialDensity(temp, salinity) - 1000.0;
}

/**
 * Given a target sigma_theta and temperature, calculate the corresponding salinity.
 * Used to draw isopycnal curves on the T-S plot.
 */
export function solveSalinityForSigmaTheta(sigmaTarget: number, temp: number): number {
  // Invert rho(T, S) numerically using Newton-Raphson
  let s = 34.0; // initial guess
  for (let iter = 0; iter < 10; iter++) {
    const currentSigma = computeSigmaTheta(temp, s);
    const diff = currentSigma - sigmaTarget;
    if (Math.abs(diff) < 1e-4) break;
    // Numerical derivative dSigma/dS
    const dSigma = (computeSigmaTheta(temp, s + 0.01) - computeSigmaTheta(temp, s - 0.01)) / 0.02;
    s = s - diff / dSigma;
  }
  return s;
}

export interface IsopycnalCurve {
  sigma: number;
  points: { salinity: number; temp: number }[];
}

/**
 * Generate isopycnal lines across the typical Bay of Bengal (T, S) domain.
 */
export function generateIsopycnals(
  salMin = 28,
  salMax = 37,
  tempMin = 4,
  tempMax = 32,
  sigmas = [21, 22, 23, 24, 25, 26, 27, 27.5, 28]
): IsopycnalCurve[] {
  const curves: IsopycnalCurve[] = [];

  for (const sigma of sigmas) {
    const points: { salinity: number; temp: number }[] = [];
    const tSteps = 25;
    for (let i = 0; i <= tSteps; i++) {
      const temp = tempMin + (i / tSteps) * (tempMax - tempMin);
      const s = solveSalinityForSigmaTheta(sigma, temp);
      if (s >= salMin - 0.5 && s <= salMax + 0.5) {
        points.push({ salinity: parseFloat(s.toFixed(2)), temp: parseFloat(temp.toFixed(2)) });
      }
    }
    if (points.length >= 2) {
      curves.push({ sigma, points });
    }
  }

  return curves;
}

/**
 * Classify a (T, S, depth) sample into recognized Northern Indian Ocean / Bay of Bengal water mass signatures.
 */
export function classifyWaterMass(temp: number, salinity: number, depth: number): {
  name: string;
  code: string;
  color: string;
  badgeBg: string;
  description: string;
} {
  if (depth < 40 && salinity < 33.2) {
    return {
      name: 'Bay of Bengal Fresh Water',
      code: 'BBFW',
      color: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
      description: 'Warm, low-salinity river-diluted surface plume (Ganges-Brahmaputra runoff).',
    };
  }

  if (temp > 22 && depth <= 120) {
    return {
      name: 'Tropical Surface Water',
      code: 'TSW',
      color: '#fbbf24',
      badgeBg: 'rgba(251, 191, 36, 0.15)',
      description: 'Solar-heated upper mixed layer with active atmospheric exchange.',
    };
  }

  if (depth > 50 && depth <= 250 && temp > 14 && temp <= 22) {
    return {
      name: 'Thermocline Transition Water',
      code: 'TTW',
      color: '#f97316',
      badgeBg: 'rgba(249, 115, 22, 0.15)',
      description: 'Sharp thermal & density gradient layer; critical zone for internal waves.',
    };
  }

  if (temp > 8 && temp <= 16 && salinity >= 34.7) {
    return {
      name: 'Indian Ocean Central Water',
      code: 'IOCW',
      color: '#a855f7',
      badgeBg: 'rgba(168, 85, 247, 0.15)',
      description: 'Subsurface water mass subducted in the Southern Subtropical Gyre.',
    };
  }

  if (temp > 4.5 && temp <= 8.5 && salinity >= 34.8) {
    return {
      name: 'Red Sea / Persian Gulf Intermediate',
      code: 'RSIW',
      color: '#ec4899',
      badgeBg: 'rgba(236, 72, 153, 0.15)',
      description: 'Warm, saline outflow advected eastwards into the Bay of Bengal.',
    };
  }

  return {
    name: 'North Indian Deep Water',
    code: 'NIDW',
    color: '#6366f1',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    description: 'Cold, stable abyss water mass originating from Antarctic circumpolar mixing.',
  };
}

/**
 * Compute biogeochemical Deep Chlorophyll Maximum (DCM) profile for the Bay of Bengal
 */
export function computeDCMChlorophyll(depth: number, lat = 15.0): number {
  const dcmDepth = 65.0 + 8.0 * Math.sin((lat * Math.PI) / 18);
  if (depth <= 200) {
    return 0.18 + 1.75 * Math.exp(-Math.pow((depth - dcmDepth) / 26.0, 2));
  }
  return Math.max(0.01, 0.18 * Math.exp(-(depth - 200) / 80.0));
}
