import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:eventology_app/models/enquiries_model.dart';
import 'package:eventology_app/features/admin/admin_enquiries_tab.dart';

void main() {
  final sampleEvents = [
    {'id': 'event_wedding_101', 'name': 'Royal Wedding'},
    {'id': 'event_corporate_202', 'name': 'Tech Summit 2026'},
  ];

  final sampleVendors = [
    {'id': 'vendor_photo_1', 'name': 'Royal Photography'},
    {'id': 'vendor_caterer_2', 'name': 'Grand Feast Catering'},
  ];

  final sampleServices = [
    {'id': 'srv_photo_1', 'name': 'Full Day Photography'},
    {'id': 'srv_catering_1', 'name': 'Premium Buffet'},
  ];

  Widget buildTestApp(Widget child) {
    return MaterialApp(
      home: Scaffold(
        body: Center(child: child),
      ),
    );
  }

  group('EnquiryFormDialog - Vendor Enquiry Validation', () {
    testWidgets('Normal vendor enquiry requires event, vendor, and service', (tester) async {
      EnquiryModel? savedItem;

      await tester.pumpWidget(
        buildTestApp(
          EnquiryFormDialog(
            initialEvents: sampleEvents,
            initialVendors: sampleVendors,
            initialServices: sampleServices,
            onSave: (item) async {
              savedItem = item;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Enter customer ID and message only
      await tester.enterText(
        find.byKey(const Key('enquiry_customer_id_field')),
        'customer_user_99',
      );
      await tester.enterText(
        find.byKey(const Key('enquiry_message_field')),
        'Need service quote for event',
      );

      // Tap Save without selecting event, vendor, or service
      await tester.tap(find.byKey(const Key('enquiry_save_button')));
      await tester.pumpAndSettle();

      // Validation errors should be present for the required fields
      expect(find.text('Required'), findsNWidgets(3));
      expect(savedItem, isNull);
    });

    testWidgets('Normal vendor enquiry saves when all required fields are selected', (tester) async {
      EnquiryModel? savedItem;

      await tester.pumpWidget(
        buildTestApp(
          EnquiryFormDialog(
            initialEvents: sampleEvents,
            initialVendors: sampleVendors,
            initialServices: sampleServices,
            onSave: (item) async {
              savedItem = item;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Enter text fields
      await tester.enterText(
        find.byKey(const Key('enquiry_customer_id_field')),
        'customer_user_99',
      );
      await tester.enterText(
        find.byKey(const Key('enquiry_message_field')),
        'Need service quote for event',
      );

      // Select Event
      await tester.tap(find.byKey(const Key('enquiry_event_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Royal Wedding').last);
      await tester.pumpAndSettle();

      // Select Vendor
      await tester.tap(find.byKey(const Key('enquiry_vendor_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Royal Photography').last);
      await tester.pumpAndSettle();

      // Select Service
      await tester.tap(find.byKey(const Key('enquiry_service_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Full Day Photography').last);
      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.byKey(const Key('enquiry_save_button')));
      await tester.pumpAndSettle();

      expect(savedItem, isNotNull);
      expect(savedItem!.eventId, 'event_wedding_101');
      expect(savedItem!.vendorId, 'vendor_photo_1');
      expect(savedItem!.serviceId, 'srv_photo_1');
      expect(savedItem!.customerId, 'customer_user_99');
    });
  });

  group('EnquiryFormDialog - Venue Enquiry Compatibility', () {
    final venueEnquiry = EnquiryModel(
      enquiryId: 'enq_venue_test_101',
      eventId: '',
      customerId: 'customer_venue_shopper',
      vendorId: '',
      serviceId: '',
      message: 'Looking to reserve the Grand Ballroom for 250 guests',
      requirements: {
        'type': 'venue',
        'venueId': 'venue_grand_ballroom_1',
        'venueName': 'The Grand Ballroom',
        'guestCount': 250,
        'source': 'manual_discovery',
        'notes': 'Special lighting needed',
      },
      requestedDate: Timestamp.now(),
      status: 'pending',
      createdAt: Timestamp.now(),
    );

    testWidgets('Venue enquiry can be edited without selecting a vendor or service and does not crash', (tester) async {
      EnquiryModel? savedItem;

      await tester.pumpWidget(
        buildTestApp(
          EnquiryFormDialog(
            item: venueEnquiry,
            initialEvents: sampleEvents,
            initialVendors: sampleVendors,
            initialServices: sampleServices,
            onSave: (item) async {
              savedItem = item;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify title shows 'Edit Venue Enquiry'
      expect(find.text('Edit Venue Enquiry'), findsOneWidget);

      // Verify venue info card is rendered
      expect(find.text('The Grand Ballroom'), findsOneWidget);
      expect(find.text('Guests: 250'), findsOneWidget);

      // Verify existing notes and message are populated
      expect(find.text('Looking to reserve the Grand Ballroom for 250 guests'), findsOneWidget);
      expect(find.text('Special lighting needed'), findsOneWidget);

      // Attempt to save without selecting vendor or service
      await tester.tap(find.byKey(const Key('enquiry_save_button')));
      await tester.pumpAndSettle();

      // Should save successfully without requiring vendor or service
      expect(savedItem, isNotNull);
      expect(find.text('Required'), findsNothing);
    });

    testWidgets('Saving a venue enquiry preserves venue ID, enquiry type, and metadata without conversion', (tester) async {
      EnquiryModel? savedItem;

      // Set surface size large enough to comfortably accommodate the form dialog
      tester.view.physicalSize = const Size(1000, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        buildTestApp(
          EnquiryFormDialog(
            item: venueEnquiry,
            initialEvents: sampleEvents,
            initialVendors: sampleVendors,
            initialServices: sampleServices,
            onSave: (item) async {
              savedItem = item;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Change status to responded
      await tester.ensureVisible(find.byKey(const Key('enquiry_status_dropdown')));
      await tester.tap(find.byKey(const Key('enquiry_status_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('RESPONDED').last);
      await tester.pumpAndSettle();

      // Update notes
      await tester.ensureVisible(find.byKey(const Key('enquiry_requirements_field')));
      await tester.enterText(
        find.byKey(const Key('enquiry_requirements_field')),
        'Confirmed availability with venue manager',
      );

      // Save
      await tester.tap(find.byKey(const Key('enquiry_save_button')));
      await tester.pumpAndSettle();

      expect(savedItem, isNotNull);
      // Venue enquiry type and venueId MUST be preserved
      expect(savedItem!.requirements?['type'], 'venue');
      expect(savedItem!.requirements?['venueId'], 'venue_grand_ballroom_1');
      expect(savedItem!.requirements?['venueName'], 'The Grand Ballroom');
      expect(savedItem!.requirements?['guestCount'], 250);
      expect(savedItem!.requirements?['source'], 'manual_discovery');
      expect(savedItem!.requirements?['notes'], 'Confirmed availability with venue manager');

      // vendorId and serviceId must remain empty, not converted to vendor enquiry
      expect(savedItem!.vendorId, '');
      expect(savedItem!.serviceId, '');
      expect(savedItem!.eventId, '');

      // Status should be updated
      expect(savedItem!.status, 'responded');
    });

    testWidgets('Editing a venue enquiry with null or empty selections handles gracefully without crashing', (tester) async {
      final minimalVenueEnquiry = EnquiryModel(
        enquiryId: 'enq_minimal_venue',
        eventId: '',
        customerId: 'cust_min_01',
        vendorId: '',
        serviceId: '',
        message: 'Minimal venue query',
        requirements: {
          'type': 'venue',
          'venueId': 'venue_minimal',
        },
        requestedDate: Timestamp.now(),
        status: 'pending',
        createdAt: Timestamp.now(),
      );

      EnquiryModel? savedItem;

      await tester.pumpWidget(
        buildTestApp(
          EnquiryFormDialog(
            item: minimalVenueEnquiry,
            initialEvents: sampleEvents,
            initialVendors: sampleVendors,
            initialServices: sampleServices,
            onSave: (item) async {
              savedItem = item;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Notes are null/empty, event, vendor, service are null/empty
      await tester.tap(find.byKey(const Key('enquiry_save_button')));
      await tester.pumpAndSettle();

      expect(savedItem, isNotNull);
      expect(savedItem!.requirements?['type'], 'venue');
      expect(savedItem!.requirements?['venueId'], 'venue_minimal');
      expect(savedItem!.vendorId, '');
      expect(savedItem!.serviceId, '');
    });
  });
}
