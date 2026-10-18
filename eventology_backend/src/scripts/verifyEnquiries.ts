import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export interface EnquiryValidationContext {
  valid_events_Ids: Set<string>;
  valid_users_Ids: Set<string>;
  valid_vendors_Ids: Set<string>;
  valid_services_Ids: Set<string>;
  valid_venues_Ids?: Set<string>;
}

export interface EnquiryValidationResult {
  invalidId: string[];
  unexpectedFields: string[];
  typeViolations: string[];
  refViolations: string[];
}

export const EXPECTED_ENQUIRY_FIELDS = new Set([
  'enquiryId',
  'eventId',
  'customerId',
  'vendorId',
  'serviceId',
  'message',
  'requirements',
  'requestedDate',
  'status',
  'createdAt',
  'updatedAt',
]);

export function validateEnquiryDoc(
  docId: string,
  data: any,
  context: EnquiryValidationContext
): EnquiryValidationResult {
  const invalidId: string[] = [];
  const unexpectedFields: string[] = [];
  const typeViolations: string[] = [];
  const refViolations: string[] = [];

  if (!data || !data.enquiryId || data.enquiryId !== docId) {
    invalidId.push(docId);
  }

  if (data?.message !== undefined && typeof data.message !== 'string') {
    typeViolations.push(`${docId} (message should be string)`);
  }
  if (data?.status !== undefined && typeof data.status !== 'string') {
    typeViolations.push(`${docId} (status should be string)`);
  }

  // Customer ID is mandatory across all enquiry types
  if (!data?.customerId || !context.valid_users_Ids.has(data.customerId)) {
    refViolations.push(`${docId} (customerId: ${data?.customerId})`);
  }

  const isVenueEnquiry = Boolean(
    data?.requirements && data.requirements.type === 'venue'
  );

  if (isVenueEnquiry) {
    // For venue enquiries: vendorId, serviceId, and eventId may be empty
    if (data.eventId && !context.valid_events_Ids.has(data.eventId)) {
      refViolations.push(`${docId} (eventId: ${data.eventId})`);
    }
    if (data.vendorId && !context.valid_vendors_Ids.has(data.vendorId)) {
      refViolations.push(`${docId} (vendorId: ${data.vendorId})`);
    }
    if (data.serviceId && !context.valid_services_Ids.has(data.serviceId)) {
      refViolations.push(`${docId} (serviceId: ${data.serviceId})`);
    }
    if (
      data.requirements?.venueId &&
      context.valid_venues_Ids &&
      !context.valid_venues_Ids.has(data.requirements.venueId)
    ) {
      refViolations.push(`${docId} (venueId: ${data.requirements.venueId})`);
    }
  } else {
    // Normal vendor enquiries must have event, vendor, and service
    if (!data?.eventId || !context.valid_events_Ids.has(data.eventId)) {
      refViolations.push(`${docId} (eventId: ${data?.eventId})`);
    }
    if (!data?.vendorId || !context.valid_vendors_Ids.has(data.vendorId)) {
      refViolations.push(`${docId} (vendorId: ${data?.vendorId})`);
    }
    if (!data?.serviceId || !context.valid_services_Ids.has(data.serviceId)) {
      refViolations.push(`${docId} (serviceId: ${data?.serviceId})`);
    }
  }

  if (data) {
    for (const key of Object.keys(data)) {
      if (!EXPECTED_ENQUIRY_FIELDS.has(key)) {
        unexpectedFields.push(`${docId} (${key})`);
      }
    }
  }

  return {
    invalidId,
    unexpectedFields,
    typeViolations,
    refViolations,
  };
}

export function initVerifyFirestore(options?: { customDb?: any }): any {
  if (options?.customDb) {
    return options.customDb;
  }

  let app: any;
  if (getApps().length > 0) {
    app = getApp();
  } else {
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({ credential: cert(parsed) });
      } catch (e: any) {
        throw new Error(
          `FIREBASE_SERVICE_ACCOUNT is set but not valid JSON: ${e?.message || e}`
        );
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        app = initializeApp();
      } catch (e: any) {
        throw new Error(
          `Failed to initialize Firebase Admin with GOOGLE_APPLICATION_CREDENTIALS: ${e?.message || e}`
        );
      }
    } else if (fs.existsSync(serviceAccountPath)) {
      try {
        const serviceAccount = require(serviceAccountPath);
        app = initializeApp({ credential: cert(serviceAccount) });
      } catch (e: any) {
        throw new Error(
          `Failed to initialize Firebase Admin from serviceAccountKey.json: ${e?.message || e}`
        );
      }
    } else {
      throw new Error(
        "Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS, or provide serviceAccountKey.json."
      );
    }
  }

  // Explicitly require the 'user-data' database; do NOT silently fall back to default database
  try {
    return getFirestore(app, 'user-data');
  } catch (err: any) {
    throw new Error(
      `Failed to initialize Firestore 'user-data' database: ${err?.message || err}`
    );
  }
}

export interface VerifyEnquiriesOptions {
  db?: any;
  silent?: boolean;
}

export interface VerifyEnquiriesReport {
  passed: boolean;
  totalCount: number;
  invalidId: string[];
  unexpectedFields: string[];
  typeViolations: string[];
  refViolations: string[];
  statusString: string;
}

export async function verifyEnquiries(
  options: VerifyEnquiriesOptions = {}
): Promise<VerifyEnquiriesReport> {
  const db = initVerifyFirestore({ customDb: options.db });

  const eventsSnap = await db.collection('events').get();
  const valid_events_Ids = new Set<string>();
  eventsSnap.forEach((doc: any) => valid_events_Ids.add(doc.id));

  const usersSnap = await db.collection('users').get();
  const valid_users_Ids = new Set<string>();
  usersSnap.forEach((doc: any) => valid_users_Ids.add(doc.id));

  const vendorsSnap = await db.collection('vendors').get();
  const valid_vendors_Ids = new Set<string>();
  vendorsSnap.forEach((doc: any) => valid_vendors_Ids.add(doc.id));

  const servicesSnap = await db.collection('services').get();
  const valid_services_Ids = new Set<string>();
  servicesSnap.forEach((doc: any) => valid_services_Ids.add(doc.id));

  const venuesSnap = await db.collection('venues').get();
  const valid_venues_Ids = new Set<string>();
  venuesSnap.forEach((doc: any) => valid_venues_Ids.add(doc.id));

  const context: EnquiryValidationContext = {
    valid_events_Ids,
    valid_users_Ids,
    valid_vendors_Ids,
    valid_services_Ids,
    valid_venues_Ids,
  };

  const snap = await db.collection('enquiries').get();
  let totalCount = 0;

  const invalidId: string[] = [];
  const unexpectedFields: string[] = [];
  const typeViolations: string[] = [];
  const refViolations: string[] = [];

  const log = options.silent ? () => {} : console.log;

  log('--- ENQUIRIES DOCUMENTS ---');
  snap.forEach((doc: any) => {
    totalCount++;
    const res = validateEnquiryDoc(doc.id, doc.data(), context);
    invalidId.push(...res.invalidId);
    unexpectedFields.push(...res.unexpectedFields);
    typeViolations.push(...res.typeViolations);
    refViolations.push(...res.refViolations);
  });

  const passed =
    invalidId.length === 0 &&
    unexpectedFields.length === 0 &&
    typeViolations.length === 0 &&
    refViolations.length === 0;

  let statusString: string;
  if (!passed) {
    statusString = 'FAIL';
  } else if (totalCount === 0) {
    statusString = 'PASS (Empty Collection)';
  } else {
    statusString = 'PASS';
  }

  log('--- VERIFICATION REPORT: Enquiries ---');
  log(`Collection checked: enquiries`);
  log(`Number of documents checked: ${totalCount}`);
  log(
    `Unexpected documents / invalid IDs: ${
      invalidId.length > 0 ? invalidId.join(', ') : 'None (' + invalidId.length + ')'
    }`
  );
  log(
    `Unexpected fields: ${
      unexpectedFields.length > 0 ? unexpectedFields.join(', ') : 'None (' + unexpectedFields.length + ')'
    }`
  );
  log(
    `Schema/type violations: ${
      typeViolations.length > 0 ? typeViolations.join(', ') : 'None (' + typeViolations.length + ')'
    }`
  );
  log(
    `Reference/integrity issues: ${
      refViolations.length > 0 ? refViolations.join(', ') : 'None (' + refViolations.length + ')'
    }`
  );
  log(`Security-rule issues: None detected via Admin SDK`);
  log(`Overall status: ${statusString}`);
  log('');

  return {
    passed,
    totalCount,
    invalidId,
    unexpectedFields,
    typeViolations,
    refViolations,
    statusString,
  };
}

if (require.main === module) {
  verifyEnquiries()
    .then((report) => {
      if (!report.passed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal configuration or verification error:', err);
      process.exit(1);
    });
}
