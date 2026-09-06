export function isSpecialSpiffAvailableForDate(
  spiff: { active: boolean; endDate?: Date | null },
  activityDate: Date,
) {
  return spiff.active && (!spiff.endDate || activityDate <= spiff.endDate);
}
