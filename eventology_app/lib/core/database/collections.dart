/// Centralized Firestore collection name constants.
///
/// ALL Firestore collection references in this application MUST use these
/// constants. Do NOT hardcode collection name strings anywhere else.
///
/// This file is the single source of truth for the Eventalogy ERP collection
/// names against the `user-data` Firestore database.

class Collections {
  Collections._(); // Prevent instantiation

  // ── MASTER DATA ──────────────────────────────────────────────────────────
  static const String users = 'users';
  static const String venues = 'venues';
  static const String vendors = 'vendors';
  static const String services = 'services';
  static const String packages = 'packages';
  static const String categories = 'categories';
  static const String eventTypes = 'eventTypes';
  static const String locations = 'locations';
  static const String venueTypes = 'venueTypes';

  // ── TRANSACTION DATA ──────────────────────────────────────────────────────
  static const String events = 'events';             // evt_<yyyyMMdd>_<slug>
  static const String enquiries = 'enquiries';       // enq_<yyyyMMdd>_<slug>
  static const String rfqs = 'rfqs';                 // rfq_<eventId>_<category>
  static const String quotations = 'quotations';     // qtn_<rfqId>_<vendorSlug>
  static const String bookings = 'bookings';         // bkg_<eventId>_<vendorSlug>
  static const String allocations = 'allocations';   // alc_<bookingId>_<resourceSlug>
  static const String payments = 'payments';         // pay_<razorpayId>
  static const String settlements = 'settlements';   // stl_<bookingId>_m<milestoneNum>
  static const String reviews = 'reviews';           // rev_<bookingId>

  // ── GOVERNANCE & OPERATIONS ───────────────────────────────────────────────
  static const String disputes = 'disputes';         // dsp_<bookingId>
  static const String notifications = 'notifications';
  static const String auditLogs = 'audit_logs';      // log_<isoTimestamp>_<action>
  static const String settings = 'settings';
}
