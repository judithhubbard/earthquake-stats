const TREND_SERIES = [
  { threshold: MIN_MAGNITUDE, mainshocksOnly: false },
  { threshold: MIN_MAGNITUDE, mainshocksOnly: true },
  { threshold: MAJOR_MAGNITUDE, mainshocksOnly: false },
  { threshold: MAJOR_MAGNITUDE, mainshocksOnly: true },
];


// Only used to report the correlation between the four series.
/**
 * How strongly the four series move together, as a range.
 *
 * Quoted on the page rather than asserted, because it is the reason the
 * textbook correction is not used, and because it moves with the catalogue.
 */
function correlationRange(cols: number[][]): { min: number; max: number } | null {
  const centred = cols.map((c) => {
    const mean = c.reduce((a, v) => a + v, 0) / c.length;
    return c.map((v) => v - mean);
  });
  const pairs: number[] = [];
  for (let i = 0; i < centred.length; i++) {
    for (let j = i + 1; j < centred.length; j++) {
      const a = centred[i], b = centred[j];
      const num = a.reduce((acc, v, k) => acc + v * b[k], 0);
      const den = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0)
                          * b.reduce((acc, v) => acc + v * v, 0));
      if (den > 0) pairs.push(num / den);
    }
  }
  if (!pairs.length) return null;
  return { min: Math.min(...pairs), max: Math.max(...pairs) };
}
