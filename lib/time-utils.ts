
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { logger } from './logger';

export function calculateLocalDeadline(
  deadlineValue: string, // eg: "2026-04-15T17:00"
  projectTimezone: string, // eg: "America/New_York"
  actorTimezone: string // eg: "Europe/Paris"
): string | null {
  if (!deadlineValue || !projectTimezone) return null;

  try {
    const dateInProjectTZ = toDate(deadlineValue, { timeZone: projectTimezone });
    
    return formatInTimeZone(
      dateInProjectTZ, 
      actorTimezone, 
      "PP, p z"
    );
  } catch (error) {
    logger.error({ err: error, msg: 'Error calculating local deadline' });
    return null;
  }
}