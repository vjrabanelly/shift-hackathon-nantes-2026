export type NormalizationStrategy =
  | 'min-max'
  | 'clipped-min-max'
  | 'log-min-max'
  | 'sqrt';

export interface NormalizationRange {
  min: number;
  max: number;
}

export interface NormalizationSeriesOptions {
  strategy?: NormalizationStrategy;
  clipPercentiles?: readonly [number, number];
  outputMin?: number;
  outputMax?: number;
  constantValue?: number | 'auto';
}

export interface NormalizationSeriesResult {
  values: number[];
  rawRange: NormalizationRange;
  transformedRange: NormalizationRange;
  strategy: NormalizationStrategy;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const rank = clamp(p, 0, 1) * (values.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;

  if (lower === upper) return values[lower];
  return values[lower] * (1 - weight) + values[upper] * weight;
}

function buildRange(values: number[]): NormalizationRange {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function transformValues(
  values: number[],
  strategy: NormalizationStrategy,
  clipPercentiles: readonly [number, number],
): { values: number[]; rawRange: NormalizationRange; transformedRange: NormalizationRange } {
  const rawRange = buildRange(values);

  if (values.length === 0) {
    return {
      values: [],
      rawRange,
      transformedRange: { min: 0, max: 0 },
    };
  }

  let transformed = [...values];

  switch (strategy) {
    case 'clipped-min-max': {
      const [lowerP, upperP] = clipPercentiles;
      const sortedValues = sorted(values);
      const lower = percentile(sortedValues, lowerP);
      const upper = percentile(sortedValues, upperP);
      transformed = values.map(value => clamp(value, lower, upper));
      break;
    }
    case 'log-min-max': {
      const shift = rawRange.min < 0 ? Math.abs(rawRange.min) : 0;
      transformed = values.map(value => Math.log1p(Math.max(0, value + shift)));
      break;
    }
    case 'sqrt': {
      const shift = rawRange.min < 0 ? Math.abs(rawRange.min) : 0;
      transformed = values.map(value => Math.sqrt(Math.max(0, value + shift)));
      break;
    }
    case 'min-max':
    default:
      break;
  }

  return {
    values: transformed,
    rawRange,
    transformedRange: buildRange(transformed),
  };
}

export function normalizeSeries(
  inputValues: number[],
  options: NormalizationSeriesOptions = {},
): NormalizationSeriesResult {
  const strategy = options.strategy ?? 'min-max';
  const outputMin = options.outputMin ?? 0;
  const outputMax = options.outputMax ?? 100;
  const clipPercentiles = options.clipPercentiles ?? [0.05, 0.95];

  const values = inputValues.map(value => safeNumber(value, 0));
  const transformed = transformValues(values, strategy, clipPercentiles);

  if (transformed.values.length === 0) {
    return {
      values: [],
      rawRange: transformed.rawRange,
      transformedRange: transformed.transformedRange,
      strategy,
    };
  }

  const { min, max } = transformed.transformedRange;
  const midpoint = outputMin + ((outputMax - outputMin) / 2);
  const constantValue = options.constantValue ?? 'auto';

  const normalizedValues = transformed.values.map(value => {
    if (max === min) {
      if (constantValue === 'auto') {
        return min === 0 && max === 0 ? outputMin : midpoint;
      }
      return constantValue;
    }

    const ratio = (value - min) / (max - min);
    return outputMin + (ratio * (outputMax - outputMin));
  });

  return {
    values: normalizedValues,
    rawRange: transformed.rawRange,
    transformedRange: transformed.transformedRange,
    strategy,
  };
}

export function normalizeValue(
  value: number,
  range: NormalizationRange,
  options: Pick<NormalizationSeriesOptions, 'outputMin' | 'outputMax' | 'constantValue'> = {},
): number {
  const outputMin = options.outputMin ?? 0;
  const outputMax = options.outputMax ?? 100;
  const midpoint = outputMin + ((outputMax - outputMin) / 2);
  const safeValue = safeNumber(value, 0);

  if (range.max === range.min) {
    const constantValue = options.constantValue ?? 'auto';
    if (constantValue === 'auto') {
      return range.min === 0 && range.max === 0 ? outputMin : midpoint;
    }
    return constantValue;
  }

  const ratio = (safeValue - range.min) / (range.max - range.min);
  return outputMin + (clamp(ratio, 0, 1) * (outputMax - outputMin));
}

export function remap01To100(value: number): number {
  return clamp(safeNumber(value, 0), 0, 1) * 100;
}

export function remap04To100(value: number): number {
  return clamp(safeNumber(value, 0), 0, 4) * 25;
}

