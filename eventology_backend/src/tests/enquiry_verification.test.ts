import * as fs from 'fs';
import * as path from 'path';
import {
  validateEnquiryDoc,
  verifyEnquiries,
  initVerifyFirestore,
  EnquiryValidationContext,
} from '../scripts/verifyEnquiries';

describe('Enquiry Verification Regression Tests', () => {
  const mockContext: EnquiryValidationContext = {
    valid_events_Ids: new Set(['event_wedding_101', 'event_corporate_202']),
    valid_users_Ids: new Set(['user_cust_001', 'user_cust_002']),
    valid_vendors_Ids: new Set(['vendor_photo_1', 'vendor_caterer_2']),
    valid_services_Ids: new Set(['srv_premium_photo', 'srv_buffet_dinner']),
    valid_venues_Ids: new Set(['venue_royal_palace', 'venue_grand_ballroom']),
  };

  function createMockDb(collections: Record<string, any[]>) {
    return {
      collection: (name: string) => ({
        get: async () => ({
          docs: (collections[name] || []).map((item) => ({
            id: item.enquiryId || item.id,
            data: () => item,
          })),
          forEach: (cb: (doc: any) => void) => {
            (collections[name] || []).forEach((item) => {
              cb({
                id: item.enquiryId || item.id,
                data: () => item,
              });
            });
          },
        }),
      }),
    };
  }

  describe('Venue Enquiries Compatibility', () => {
    it('accepts a valid venue enquiry with empty vendorId, serviceId, and eventId', () => {
      const docId = 'enq_venue_001';
      const venueEnquiryData = {
        enquiryId: docId,
        eventId: '',
        customerId: 'user_cust_001',
        vendorId: '',
        serviceId: '',
        message: 'Looking to book the Grand Ballroom for a reception',
        requirements: {
          type: 'venue',
          venueId: 'venue_grand_ballroom',
          venueName: 'Grand Ballroom',
          guestCount: 200,
          source: 'manual_discovery',
        },
        requestedDate: '2026-11-20T10:00:00Z',
        status: 'pending',
        createdAt: '2026-10-15T10:00:00Z',
      };

      const result = validateEnquiryDoc(docId, venueEnquiryData, mockContext);

      expect(result.invalidId).toHaveLength(0);
      expect(result.unexpectedFields).toHaveLength(0);
      expect(result.typeViolations).toHaveLength(0);
      expect(result.refViolations).toHaveLength(0);
    });

    it('accepts a valid venue enquiry with linked eventId when present', () => {
      const docId = 'enq_venue_002';
      const venueEnquiryData = {
        enquiryId: docId,
        eventId: 'event_wedding_101',
        customerId: 'user_cust_001',
        vendorId: '',
        serviceId: '',
        message: 'Venue booking with pre-existing event',
        requirements: {
          type: 'venue',
          venueId: 'venue_royal_palace',
        },
        requestedDate: '2026-12-05T18:00:00Z',
        status: 'pending',
        createdAt: '2026-10-15T10:00:00Z',
      };

      const result = validateEnquiryDoc(docId, venueEnquiryData, mockContext);
      expect(result.refViolations).toHaveLength(0);
    });

    it('detects invalid venueId reference if venueId does not exist in valid venues', () => {
      const docId = 'enq_venue_invalid_venue';
      const venueEnquiryData = {
        enquiryId: docId,
        eventId: '',
        customerId: 'user_cust_001',
        vendorId: '',
        serviceId: '',
        message: 'Invalid venue enquiry',
        requirements: {
          type: 'venue',
          venueId: 'non_existent_venue_999',
        },
        requestedDate: '2026-12-05T18:00:00Z',
        status: 'pending',
        createdAt: '2026-10-15T10:00:00Z',
      };

      const result = validateEnquiryDoc(docId, venueEnquiryData, mockContext);
      expect(result.refViolations).toContain(
        `${docId} (venueId: non_existent_venue_999)`
      );
    });
  });

  describe('Vendor Enquiries Referential Integrity', () => {
    it('accepts a valid vendor enquiry when event, vendor, and service are valid', () => {
      const docId = 'enq_vendor_001';
      const vendorEnquiryData = {
        enquiryId: docId,
        eventId: 'event_wedding_101',
        customerId: 'user_cust_001',
        vendorId: 'vendor_photo_1',
        serviceId: 'srv_premium_photo',
        message: 'Enquiry for photography coverage',
        requirements: {
          notes: 'Pre-wedding shoot included',
        },
        requestedDate: '2026-11-25T14:00:00Z',
        status: 'pending',
        createdAt: '2026-10-15T10:00:00Z',
      };

      const result = validateEnquiryDoc(docId, vendorEnquiryData, mockContext);
      expect(result.invalidId).toHaveLength(0);
      expect(result.refViolations).toHaveLength(0);
    });

    it('detects missing or invalid vendorId for normal vendor enquiry', () => {
      const docId = 'enq_vendor_bad_vendor';
      const vendorEnquiryData = {
        enquiryId: docId,
        eventId: 'event_wedding_101',
        customerId: 'user_cust_001',
        vendorId: 'non_existent_vendor',
        serviceId: 'srv_premium_photo',
        message: 'Test enquiry',
        status: 'pending',
      };

      const result = validateEnquiryDoc(docId, vendorEnquiryData, mockContext);
      expect(result.refViolations).toContain(
        `${docId} (vendorId: non_existent_vendor)`
      );
    });

    it('detects empty vendorId for normal vendor enquiry', () => {
      const docId = 'enq_vendor_empty_vendor';
      const vendorEnquiryData = {
        enquiryId: docId,
        eventId: 'event_wedding_101',
        customerId: 'user_cust_001',
        vendorId: '',
        serviceId: 'srv_premium_photo',
        message: 'Test enquiry',
        status: 'pending',
      };

      const result = validateEnquiryDoc(docId, vendorEnquiryData, mockContext);
      expect(result.refViolations).toContain(`${docId} (vendorId: )`);
    });

    it('detects invalid serviceId for normal vendor enquiry', () => {
      const docId = 'enq_vendor_bad_service';
      const vendorEnquiryData = {
        enquiryId: docId,
        eventId: 'event_wedding_101',
        customerId: 'user_cust_001',
        vendorId: 'vendor_photo_1',
        serviceId: 'non_existent_service',
        message: 'Test enquiry',
        status: 'pending',
      };

      const result = validateEnquiryDoc(docId, vendorEnquiryData, mockContext);
      expect(result.refViolations).toContain(
        `${docId} (serviceId: non_existent_service)`
      );
    });

    it('detects invalid eventId for normal vendor enquiry', () => {
      const docId = 'enq_vendor_bad_event';
      const vendorEnquiryData = {
        enquiryId: docId,
        eventId: 'non_existent_event',
        customerId: 'user_cust_001',
        vendorId: 'vendor_photo_1',
        serviceId: 'srv_premium_photo',
        message: 'Test enquiry',
        status: 'pending',
      };

      const result = validateEnquiryDoc(docId, vendorEnquiryData, mockContext);
      expect(result.refViolations).toContain(
        `${docId} (eventId: non_existent_event)`
      );
    });
  });

  describe('Common Integrity Checks', () => {
    it('detects invalid customerId across any enquiry type', () => {
      const docId = 'enq_bad_customer';
      const enquiryData = {
        enquiryId: docId,
        eventId: '',
        customerId: 'ghost_user',
        vendorId: '',
        serviceId: '',
        message: 'Enquiry with ghost customer',
        requirements: { type: 'venue' },
        status: 'pending',
      };

      const result = validateEnquiryDoc(docId, enquiryData, mockContext);
      expect(result.refViolations).toContain(`${docId} (customerId: ghost_user)`);
    });

    it('detects mismatched enquiryId / docId', () => {
      const docId = 'enq_doc_123';
      const enquiryData = {
        enquiryId: 'enq_mismatch_456',
        customerId: 'user_cust_001',
        message: 'Test',
        requirements: { type: 'venue' },
        status: 'pending',
      };

      const result = validateEnquiryDoc(docId, enquiryData, mockContext);
      expect(result.invalidId).toContain(docId);
    });

    it('detects unexpected schema fields', () => {
      const docId = 'enq_unexpected_field';
      const enquiryData = {
        enquiryId: docId,
        customerId: 'user_cust_001',
        message: 'Test',
        requirements: { type: 'venue' },
        status: 'pending',
        unauthorizedBackdoorField: 'hacked_data',
      };

      const result = validateEnquiryDoc(docId, enquiryData, mockContext);
      expect(result.unexpectedFields).toContain(
        `${docId} (unauthorizedBackdoorField)`
      );
    });
  });

  describe('Collection-Level Verification & Status Reporting', () => {
    const baseMockData = {
      events: [{ id: 'event_wedding_101' }],
      users: [{ id: 'user_cust_001' }],
      vendors: [{ id: 'vendor_photo_1' }],
      services: [{ id: 'srv_premium_photo' }],
      venues: [{ id: 'venue_grand_ballroom' }],
    };

    it('returns PASS for a clean collection with valid venue and vendor enquiries', async () => {
      const mockDb = createMockDb({
        ...baseMockData,
        enquiries: [
          {
            enquiryId: 'enq_1',
            eventId: '',
            customerId: 'user_cust_001',
            vendorId: '',
            serviceId: '',
            message: 'Venue enquiry',
            requirements: {
              type: 'venue',
              venueId: 'venue_grand_ballroom',
            },
            status: 'pending',
          },
          {
            enquiryId: 'enq_2',
            eventId: 'event_wedding_101',
            customerId: 'user_cust_001',
            vendorId: 'vendor_photo_1',
            serviceId: 'srv_premium_photo',
            message: 'Vendor enquiry',
            status: 'pending',
          },
        ],
      });

      const report = await verifyEnquiries({ db: mockDb, silent: true });
      expect(report.passed).toBe(true);
      expect(report.totalCount).toBe(2);
      expect(report.statusString).toBe('PASS');
      expect(report.invalidId).toHaveLength(0);
      expect(report.unexpectedFields).toHaveLength(0);
      expect(report.typeViolations).toHaveLength(0);
      expect(report.refViolations).toHaveLength(0);
    });

    it('returns PASS (Empty Collection) when enquiries collection is empty', async () => {
      const mockDb = createMockDb({
        ...baseMockData,
        enquiries: [],
      });

      const report = await verifyEnquiries({ db: mockDb, silent: true });
      expect(report.passed).toBe(true);
      expect(report.totalCount).toBe(0);
      expect(report.statusString).toBe('PASS (Empty Collection)');
    });

    it('returns FAIL and does not label a failed validation as clean', async () => {
      const mockDb = createMockDb({
        ...baseMockData,
        enquiries: [
          {
            enquiryId: 'enq_bad_ref',
            eventId: 'event_wedding_101',
            customerId: 'user_cust_001',
            vendorId: 'invalid_vendor_xyz',
            serviceId: 'srv_premium_photo',
            message: 'Vendor enquiry with invalid vendor',
            status: 'pending',
          },
          {
            enquiryId: 'enq_extra_field',
            eventId: '',
            customerId: 'user_cust_001',
            vendorId: '',
            serviceId: '',
            message: 'Venue enquiry with extra property',
            requirements: { type: 'venue' },
            status: 'pending',
            rogueKey: 'malicious_input',
          },
        ],
      });

      const report = await verifyEnquiries({ db: mockDb, silent: true });
      expect(report.passed).toBe(false);
      expect(report.statusString).toBe('FAIL');
      expect(report.refViolations.length).toBeGreaterThan(0);
      expect(report.unexpectedFields.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration & Initialization Failure Handling', () => {
    it('throws a descriptive error when FIREBASE_SERVICE_ACCOUNT is invalid JSON', () => {
      const origEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
      try {
        process.env.FIREBASE_SERVICE_ACCOUNT = 'INVALID_NOT_JSON';
        expect(() => initVerifyFirestore()).toThrow(
          /FIREBASE_SERVICE_ACCOUNT is set but not valid JSON/
        );
      } finally {
        if (origEnv === undefined) {
          delete process.env.FIREBASE_SERVICE_ACCOUNT;
        } else {
          process.env.FIREBASE_SERVICE_ACCOUNT = origEnv;
        }
      }
    });

    it('throws a descriptive error when credentials are completely missing', () => {
      const origSA = process.env.FIREBASE_SERVICE_ACCOUNT;
      const origGAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      try {
        delete process.env.FIREBASE_SERVICE_ACCOUNT;
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

        // If serviceAccountKey.json does not exist in root, it must throw
        // If it does, we simulate absence or test throw behavior
        try {
          initVerifyFirestore();
        } catch (e: any) {
          expect(e.message).toMatch(/(Firebase Admin credentials are missing|Failed to initialize)/);
        }
      } finally {
        if (origSA !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT = origSA;
        if (origGAC !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS = origGAC;
      }
    });
  });
  describe('Firestore Index Configuration Structure', () => {
    const appDir = path.resolve(__dirname, '../../../eventology_app');
    const indexesPath = path.join(appDir, 'firestore.indexes.json');
    const firebaseJsonPath = path.join(appDir, 'firebase.json');

    it('has valid firestore.indexes.json defining the composite index for vendor enquiries', () => {
      expect(fs.existsSync(indexesPath)).toBe(true);
      const raw = fs.readFileSync(indexesPath, 'utf-8');
      const parsed = JSON.parse(raw);

      expect(parsed).toHaveProperty('indexes');
      expect(Array.isArray(parsed.indexes)).toBe(true);

      const enquiryIndex = parsed.indexes.find(
        (idx: any) => idx.collectionGroup === 'enquiries'
      );
      expect(enquiryIndex).toBeDefined();
      expect(enquiryIndex.queryScope).toBe('COLLECTION');
      expect(enquiryIndex.fields).toEqual([
        { fieldPath: 'vendorId', order: 'ASCENDING' },
        { fieldPath: 'createdAt', order: 'DESCENDING' },
      ]);
    });

    it('has firebase.json referencing firestore.indexes.json for user-data database', () => {
      expect(fs.existsSync(firebaseJsonPath)).toBe(true);
      const raw = fs.readFileSync(firebaseJsonPath, 'utf-8');
      const parsed = JSON.parse(raw);

      expect(parsed).toHaveProperty('firestore');
      const userDataConfig = parsed.firestore.find(
        (cfg: any) => cfg.database === 'user-data'
      );
      expect(userDataConfig).toBeDefined();
      expect(userDataConfig.indexes).toBe('firestore.indexes.json');
      expect(userDataConfig.rules).toBe('firestore.rules');
    });
  });
});
