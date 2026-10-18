import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:eventology_app/models/enquiries_model.dart';
import 'package:eventology_app/models/vendor_model.dart';
import 'package:eventology_app/models/venue_model.dart';
import 'package:eventology_app/features/user/catalog/widgets/manual_enquiry_sheet.dart';

class FakeUser implements User {
  @override
  final String uid;

  FakeUser({required this.uid});

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  final testVendor = VendorModel(
    vendorId: 'vendor_123',
    userId: 'user_vendor_123',
    businessName: 'Royal Clicks Photography',
    ownerName: 'Rajesh Sharma',
    categoryIds: ['cat_photo'],
    serviceIds: ['srv_photo_01'],
    verified: true,
    status: 'active',
    createdAt: Timestamp.now(),
  );

  final testVenue = VenueModel(
    venueId: 'venue_456',
    name: 'The Grand Palace',
    venueTypeId: 'vt_banquet',
    locationId: 'loc_mumbai',
    capacity: 500,
    status: 'active',
    verified: true,
    createdAt: Timestamp.now(),
  );

  final testUser = FakeUser(uid: 'customer_789');

  Widget buildTestApp(Widget child) {
    return MaterialApp(
      home: Scaffold(
        body: child,
      ),
    );
  }

  group('ManualEnquirySheet - Form Validation', () {
    testWidgets('shows validation errors when submitted empty', (tester) async {
      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVendor(
            vendor: testVendor,
            currentUser: testUser,
            onSubmit: (enquiry) async => 'enquiry_001',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Royal Clicks Photography'), findsOneWidget);
      expect(find.text('Send Enquiry'), findsOneWidget);

      // Tap submit without filling date or message
      final submitButton = find.byKey(const Key('submit_enquiry_button'));
      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      // Check validation error messages
      expect(find.text('Please select a target date'), findsOneWidget);
      expect(find.text('Please provide details for your enquiry'), findsOneWidget);
    });

    testWidgets('validates message length and invalid guest count', (tester) async {
      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVenue(
            venue: testVenue,
            currentUser: testUser,
            onSubmit: (enquiry) async => 'enquiry_002',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('The Grand Palace'), findsOneWidget);
      expect(find.text('Enquire Availability'), findsOneWidget);

      // Enter short message and invalid guests
      await tester.enterText(find.byType(TextFormField).first, '-10'); // Guests field
      await tester.enterText(find.byType(TextFormField).last, 'hi'); // Message field

      final submitButton = find.byKey(const Key('submit_enquiry_button'));
      await tester.tap(submitButton);
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid guest count (> 0)'), findsOneWidget);
      expect(find.text('Message must be at least 5 characters'), findsOneWidget);
    });
  });

  group('ManualEnquirySheet - Successful Submissions', () {
    testWidgets('submits vendor enquiry with correct schema and parameters', (tester) async {
      EnquiryModel? submittedEnquiry;

      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVendor(
            vendor: testVendor,
            currentUser: testUser,
            onSubmit: (enquiry) async {
              submittedEnquiry = enquiry;
              return 'enq_success_1';
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Select date via date picker
      await tester.tap(find.byIcon(Icons.calendar_today));
      await tester.pumpAndSettle();
      // Confirm date picker dialog
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      // Enter guests and message
      await tester.enterText(find.byType(TextFormField).first, '120');
      await tester.enterText(find.byType(TextFormField).last, 'We need full day photography coverage for our wedding.');

      // Tap submit
      await tester.tap(find.byKey(const Key('submit_enquiry_button')));
      await tester.pumpAndSettle();

      expect(submittedEnquiry, isNotNull);
      expect(submittedEnquiry!.customerId, equals('customer_789'));
      expect(submittedEnquiry!.vendorId, equals('vendor_123'));
      expect(submittedEnquiry!.serviceId, equals('srv_photo_01'));
      expect(submittedEnquiry!.status, equals('pending'));
      expect(submittedEnquiry!.message, equals('We need full day photography coverage for our wedding.'));
      expect(submittedEnquiry!.requirements?['type'], equals('vendor'));
      expect(submittedEnquiry!.requirements?['vendorName'], equals('Royal Clicks Photography'));
      expect(submittedEnquiry!.requirements?['guestCount'], equals(120));
      expect(submittedEnquiry!.requirements?['source'], equals('manual_discovery'));
    });

    testWidgets('submits venue enquiry with correct schema and parameters', (tester) async {
      EnquiryModel? submittedEnquiry;

      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVenue(
            venue: testVenue,
            currentUser: testUser,
            onSubmit: (enquiry) async {
              submittedEnquiry = enquiry;
              return 'enq_success_2';
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Select date via date picker
      await tester.tap(find.byIcon(Icons.calendar_today));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      // Enter guests and message
      await tester.enterText(find.byType(TextFormField).first, '350');
      await tester.enterText(find.byType(TextFormField).last, 'Inquiring about grand ballroom availability for anniversary.');

      await tester.tap(find.byKey(const Key('submit_enquiry_button')));
      await tester.pumpAndSettle();

      expect(submittedEnquiry, isNotNull);
      expect(submittedEnquiry!.customerId, equals('customer_789'));
      expect(submittedEnquiry!.vendorId, equals(''));
      expect(submittedEnquiry!.serviceId, equals(''));
      expect(submittedEnquiry!.status, equals('pending'));
      expect(submittedEnquiry!.requirements?['type'], equals('venue'));
      expect(submittedEnquiry!.requirements?['venueId'], equals('venue_456'));
      expect(submittedEnquiry!.requirements?['venueName'], equals('The Grand Palace'));
      expect(submittedEnquiry!.requirements?['guestCount'], equals(350));
    });
  });

  group('ManualEnquirySheet - Error Handling & Duplicate Submission Protection', () {
    testWidgets('handles submission failure gracefully without crashing', (tester) async {
      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVendor(
            vendor: testVendor,
            currentUser: testUser,
            onSubmit: (enquiry) async {
              throw Exception('Network connection timed out');
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Pick date
      await tester.tap(find.byIcon(Icons.calendar_today));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).last, 'Checking vendor availability.');
      await tester.tap(find.byKey(const Key('submit_enquiry_button')));
      await tester.pumpAndSettle();

      // Error banner should be visible
      expect(find.textContaining('Failed to submit enquiry: Exception: Network connection timed out'), findsOneWidget);
    });

    testWidgets('protects against duplicate submissions while in progress', (tester) async {
      int callCount = 0;
      final completer = Completer<String>();

      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVendor(
            vendor: testVendor,
            currentUser: testUser,
            onSubmit: (enquiry) async {
              callCount++;
              return completer.future;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Pick date
      await tester.tap(find.byIcon(Icons.calendar_today));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).last, 'Checking availability for event.');

      // Tap once
      await tester.tap(find.byKey(const Key('submit_enquiry_button')));
      await tester.pump(); // Start async call

      expect(callCount, equals(1));
      // Indicator is displayed
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Attempt second tap while submitting
      await tester.tap(find.byKey(const Key('submit_enquiry_button')));
      await tester.pump();

      // Should STILL only be 1 call
      expect(callCount, equals(1));

      // Now complete
      completer.complete('done_id');
      await tester.pumpAndSettle();
      expect(callCount, equals(1));
    });

    testWidgets('disables submission when unauthenticated', (tester) async {
      await tester.pumpWidget(
        buildTestApp(
          ManualEnquirySheet.forVendor(
            vendor: testVendor,
            currentUser: null, // Unauthenticated
            onSubmit: (enquiry) async => 'id',
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('You must be signed in to submit an enquiry.'), findsOneWidget);

      final buttonFinder = find.byKey(const Key('submit_enquiry_button'));
      final ElevatedButton button = tester.widget(buttonFinder);
      expect(button.onPressed, isNull); // Disabled
    });
  });
}
