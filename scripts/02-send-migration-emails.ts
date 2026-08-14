import fs from 'fs/promises';
import path from 'path';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('[Resend] RESEND_API_KEY is not defined in environment variables.');
}

const resend = new Resend(resendApiKey);

/**
 * Represents a stored migration record loaded from the JSON output of Step 1.
 */
interface MigrationRecord {
  email: string;
  offerName: string;
  trialEndFormatted: string;
  checkoutUrl: string;
  sessionId: string;
  status: 'pending_email' | 'email_sent' | 'failed';
  sentAt?: string;
}

/**
 * Builds the HTML content for the migration email.
 *
 * @param checkoutUrl - The customer's unique Stripe Checkout URL.
 * @param trialEndFormatted - Human-readable date when the next charge occurs.
 * @returns HTML template string.
 */
function buildEmailTemplate(checkoutUrl: string, trialEndFormatted: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2>Action Required: Update Your Billing for The Actors Copilot</h2>
      <p>Hello,</p>
      <p>We are upgrading our payment system to ensure a faster and more seamless platform experience.</p>
      <p>To keep your subscription active without any interruption, please re-enter your payment method using our secure system below:</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${checkoutUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Update Payment Details
        </a>
      </div>
      <p><strong>Note:</strong> You will <strong>not</strong> be charged today. Your first payment under the new system will only occur on <strong>${trialEndFormatted}</strong>, when your current prepaid period ends.</p>
      <p>Thank you for being a part of The Actors Copilot!</p>
    </div>
  `;
}

/**
 * Reads generated migration links and dispatches notification emails via Resend.
 * Updates local state file to preserve idempotent execution.
 *
 * @async
 * @function sendMigrationEmails
 * @returns {Promise<void>}
 */
async function sendMigrationEmails(): Promise<void> {
  const jsonPath = path.join(process.cwd(), 'scripts', 'migration_links.json');

  let fileContent: string;
  try {
    fileContent = await fs.readFile(jsonPath, 'utf-8');
  } catch {
    throw new Error(`[MigrationSender] Could not find ${jsonPath}. Run Step 1 first.`);
  }

  const records: MigrationRecord[] = JSON.parse(fileContent);
  const pendingRecords = records.filter((r) => r.status === 'pending_email');

  if (pendingRecords.length === 0) {
    console.warn('[MigrationSender] No pending emails to send.');
    return;
  }

  for (const record of pendingRecords) {
    try {
      await resend.emails.send({
        from: 'The Actors Copilot <support@theactorscopilot.com>',
        to: [record.email],
        subject: 'Action Required: Confirm your subscription details',
        html: buildEmailTemplate(record.checkoutUrl, record.trialEndFormatted),
      });

      record.status = 'email_sent';
      record.sentAt = new Date().toISOString();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MigrationSender] Failed to send email to ${record.email}:`, errorMessage);
      record.status = 'failed';
    }
  }

  // Persist current execution progress back to file
  await fs.writeFile(jsonPath, JSON.stringify(records, null, 2));
}

sendMigrationEmails().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('[MigrationSender] Fatal error in email dispatch script:', errorMessage);
});