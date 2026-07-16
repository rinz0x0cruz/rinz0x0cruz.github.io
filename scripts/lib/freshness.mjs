const millisecondsPerDay = 24 * 60 * 60 * 1000;

function utcDate(value, label) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error(`${label}: invalid snapshot date "${value}"`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function evaluateFreshness(records, asOf, { warningDays = 90, hardDays = 180 } = {}) {
  const referenceDate = utcDate(asOf, 'BUILD_DATE');
  const evaluated = records.map((record) => {
    const snapshotDate = utcDate(record.snapshotDate, record.label);
    const ageDays = Math.floor((referenceDate.valueOf() - snapshotDate.valueOf()) / millisecondsPerDay);
    if (ageDays < 0) throw new Error(`${record.label}: snapshot date is ${Math.abs(ageDays)} day(s) in the future`);
    return {
      ...record,
      ageDays,
      level: ageDays > hardDays ? 'expired' : ageDays > warningDays ? 'warning' : 'current',
    };
  });

  return {
    records: evaluated,
    warnings: evaluated.filter((record) => record.level !== 'current'),
    expired: evaluated.filter((record) => record.level === 'expired'),
  };
}