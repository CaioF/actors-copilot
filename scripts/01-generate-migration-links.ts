import fs from 'fs/promises';
import path from 'path';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { createMigrationCheckoutSession } from '../lib/stripe/migrationService';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Interface representing a subscriber raw record from Kajabi CSV.
 */
interface KajabiSubscriber {
  email: string;
  offerName: string;
  nextBillingDateStr: string;
}

/**
 * Interface representing the resulting migration payload to be saved.
 */
interface MigrationRecordResult {
  email: string;
  offerName: string;
  trialEndFormatted: string;
  checkoutUrl: string;
  sessionId: string;
  status: 'pending_email';
}

/**
 * Strongly typed map of Kajabi offer names to official Stripe Price IDs.
 */
const OFFER_PRICE_MAP: Record<string, string> = {
  'The Actors Copilot Business Class - mensal': 'price_1TuCsvEnOTJRuCTXbaAzTSbO',
  'The Actors Copilot Business Class - anual': 'price_1TwO6vEnOTJRuCTXl4ilzwrn',
  'The Actors Copilot Economy Class - mensal': 'price_1TuCshEnOTJRuCTXl1SD2vMr',
  'The Actors Copilot Economy Class - anual': 'price_1TwOUREnOTJRuCTXdUqc9fyK',
};

/**
 * Reads user data, creates Stripe checkout sessions with custom trial ends,
 * and exports the results to a JSON file for email dispatch.
 *
 * @async
 * @function generateMigrationLinks
 * @returns {Promise<void>}
 */
async function generateMigrationLinks(): Promise<void> {
  // Mock input simulation until Tracey sends the final file
  const mockSubscribers: KajabiSubscriber[] = [
    {
      email: 'minamartis@yahoo.com',
      offerName: 'The Actors Copilot Business Class - mensal',
      nextBillingDateStr: '2026-08-15 12:00:00',
    },
  ];

  const results: MigrationRecordResult[] = [];
  const successUrl = 'https://theactorscopilot.com/migration/success';
  const cancelUrl = 'https://theactorscopilot.com/migration/cancel';

  for (const subscriber of mockSubscribers) {
    try {
      const priceId = OFFER_PRICE_MAP[subscriber.offerName];

      if (!priceId) {
        console.warn(`[Migration] Skipping ${subscriber.email}: Offer "${subscriber.offerName}" not mapped.`);
        continue;
      }

      // Convert readable next billing date to Unix timestamp (seconds)
      const parsedDate = dayjs.tz(subscriber.nextBillingDateStr, 'America/Sao_Paulo');
      const trialEndUnix = parsedDate.unix();

      const session = await createMigrationCheckoutSession({
        email: subscriber.email,
        priceId,
        trialEndUnixTimestamp: trialEndUnix,
        successUrl,
        cancelUrl,
      });

      if (session.url) {
        results.push({
          email: subscriber.email,
          offerName: subscriber.offerName,
          trialEndFormatted: parsedDate.format('DD/MM/YYYY'),
          checkoutUrl: session.url,
          sessionId: session.sessionId,
          status: 'pending_email',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Migration] Failed processing ${subscriber.email}:`, errorMessage);
    }
  }

  // Export results to JSON file
  const outputPath = path.join(process.cwd(), 'scripts', 'migration_links.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
}

generateMigrationLinks().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('[Migration] Fatal error in generation script:', errorMessage);
});