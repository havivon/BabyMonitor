/** Hebrew description of a percentile (DESIGN §6.21 / §8.2 growth.* strings). */
export function percentileDescription(percentile: number): string {
  if (percentile < 3) return 'מתחת לאחוזון 3 לפי WHO';
  if (percentile > 97) return 'מעל אחוזון 97 לפי WHO';
  if (percentile >= 40 && percentile <= 60) return 'קרוב לחציון לפי WHO';
  if (percentile >= 15 && percentile <= 85) return 'בטווח הנפוץ לפי WHO';
  return percentile < 15 ? 'בטווח התקין, בקצה הנמוך' : 'בטווח התקין, בקצה הגבוה';
}
