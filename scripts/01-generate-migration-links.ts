import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { createMigrationCheckoutSession } from '../lib/stripe/migrationService';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Interface matching raw rows from Kajabi subscriptions CSV export.
 */
interface KajabiSubscriptionRow {
  'Customer Email': string;
  'Offer Title': string;
  Interval: string;
  Status: string;
  'Next Payment Date': string;
}

/**
 * Interface representing the resulting migration payload saved to JSON.
 */
interface MigrationRecordResult {
  email: string;
  offerName: string;
  trialEndFormatted: string;
  trialEndUnix: number;
  checkoutUrl: string;
  sessionId: string;
  status: 'pending_email';
}

/**
 * Strongly typed map of Kajabi offer names + interval to official Stripe Price IDs.
 */
const OFFER_PRICE_MAP: Record<string, string> = {
  'The Actors Copilot Business Class - Month': 'price_1TuCsvEnOTJRuCTXbaAzTSbO',
  'The Actors Copilot Business Class - Year': 'price_1TwO6vEnOTJRuCTXl4ilzwrn',
  'The Actors Copilot Economy Class - Month': 'price_1TuCshEnOTJRuCTXl1SD2vMr',
  'The Actors Copilot Economy Class - Year': 'price_1TwOUREnOTJRuCTXdUqc9fyK',
};

/**
 * Parses the subscriptions CSV file and filters only active subscriptions.
 *
 * @async
 * @param filePath - Path to the uploaded CSV file.
 * @returns List of active subscription rows.
 */
function parseSubscriptionsCSV(filePath: string): Promise<KajabiSubscriptionRow[]> {
  const activeRecords: KajabiSubscriptionRow[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: KajabiSubscriptionRow) => {
        if (row.Status?.trim() === 'Active' && row['Customer Email'] && row['Next Payment Date']) {
          activeRecords.push(row);
        }
      })
      .on('end', () => resolve(activeRecords))
      .on('error', (err) => reject(err));
  });
}

/**
 * Main execution function to convert CSV active subscribers into Stripe Checkout Links.
 *
 * @async
 * @function generateMigrationLinks
 * @returns {Promise<void>}
 */
async function generateMigrationLinks(): Promise<void> {
  const csvPath = path.join(process.cwd(), 'subscriptions.csv');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`[Migration] CSV file not found at ${csvPath}. Place subscriptions.csv in the project root.`);
  }

  const activeSubscribers = await parseSubscriptionsCSV(csvPath);
  console.warn(`[Migration] Found ${activeSubscribers.length} active subscriber(s) to process.`);

  const results: MigrationRecordResult[] = [];
  const successUrl = 'https://theactorscopilot.com/migration/success';
  const cancelUrl = 'https://theactorscopilot.com/migration/cancel';

  for (const subscriber of activeSubscribers) {
    const email = subscriber['Customer Email'].trim().toLowerCase();
    const offerTitle = subscriber['Offer Title'].trim();
    const interval = subscriber.Interval?.trim() || 'Month';
    const rawNextPaymentDate = subscriber['Next Payment Date'].trim();

    const lookupKey = `${offerTitle} - ${interval}`;
    const priceId = OFFER_PRICE_MAP[lookupKey];

    if (!priceId) {
      console.warn(`[Migration] Skipping ${email}: Offer key "${lookupKey}" not mapped.`);
      continue;
    }

    // Parse date format from Kajabi CSV (e.g., "Jul 28, 2026")
    const parsedDate = dayjs.tz(rawNextPaymentDate, 'MMM D, YYYY', 'America/Sao_Paulo');
    
    if (!parsedDate.isValid()) {
      console.warn(`[Migration] Skipping ${email}: Invalid date string "${rawNextPaymentDate}".`);
      continue;
    }

    const trialEndUnix = parsedDate.unix();

    try {
      const session = await createMigrationCheckoutSession({
        email,
        priceId,
        trialEndUnixTimestamp: trialEndUnix,
        successUrl,
        cancelUrl,
      });

      if (session.url) {
        results.push({
          email,
          offerName: lookupKey,
          trialEndFormatted: parsedDate.format('DD/MM/YYYY'),
          trialEndUnix,
          checkoutUrl: session.url,
          sessionId: session.sessionId,
          status: 'pending_email',
        });
        console.warn(`[Migration] Successfully generated link for ${email}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Migration] Failed processing ${email}:`, errorMessage);
    }
  }

  // Export results to JSON file
  const outputPath = path.join(process.cwd(), 'scripts', 'migration_links.json');
  await fs.promises.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.warn(`[Migration] Saved ${results.length} migration record(s) to ${outputPath}`);
}

generateMigrationLinks().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('[Migration] Fatal error in generation script:', errorMessage);
});