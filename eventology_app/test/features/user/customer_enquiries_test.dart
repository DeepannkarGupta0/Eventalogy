import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:eventology_app/features/user/enquiries/screens/customer_enquiries_screen.dart';
import 'package:eventology_app/features/user/profile/user_profile_view.dart';
import 'package:go_router/go_router.dart';
import 'package:eventology_app/core/routing/app_router.dart';
import 'package:eventology_app/models/enquiries_model.dart';
import 'package:eventology_app/services/auth_state_notifier.dart';
import 'package:eventology_app/services/firestore/enquiries_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget buildTestApp(Widget child) {
    return MaterialApp(
      theme: ThemeData.dark(),
      home: child,
    );
  }

  final sampleVenueEnquiry = EnquiryModel(
    enquiryId: 'enq_venue_001',
    eventId: '',
    customerId: 'cust_abc_123',
    vendorId: '',
    serviceId: '',
    message: 'We want to book the Grand Ballroom for a reception.',
    requirements: {
      'type': 'venue',
      'venueId': 'ven_mumbai_01',
      'venueName': 'The Taj Lands End Ballroom',
      'guestCount': 250,
      'source': 'manual_discovery',
    },
    requestedDate: Timestamp.fromDate(DateTime(2026, 12, 15)),
    status: 'pending',
    createdAt: Timestamp.fromDate(DateTime(2026, 10, 18, 14, 30)),
  );

  final sampleVendorEnquiry = EnquiryModel(
    enquiryId: 'enq_vendor_002',
    eventId: '',
    customerId: 'cust_abc_123',
    vendorId: 'vnd_photo_01',
    serviceId: 'srv_candid',
    message: 'Need 2 candid photographers and 1 drone operator.',
    requirements: {
      'type': 'vendor',
      'vendorName': 'Royal Candid Studios',
      'guestCount': 100,
      'source': 'manual_discovery',
    },
    requestedDate: Timestamp.fromDate(DateTime(2026, 11, 20)),
    status: 'vendor_accepted',
    createdAt: Timestamp.fromDate(DateTime(2026, 10, 19, 10, 15)),
  );

  final sampleDeclinedEnquiry = EnquiryModel(
    enquiryId: 'enq_declined_003',
    eventId: '',
    customerId: 'cust_abc_123',
    vendorId: 'vnd_decor_01',
    serviceId: 'srv_floral',
    message: 'Floral mandap decoration requirements.',
    requirements: {
      'type': 'vendor',
      'vendorName': 'Floral Fantasy Decor',
      'guestCount': 400,
      'source': 'manual_discovery',
    },
    requestedDate: Timestamp.fromDate(DateTime(2026, 11, 5)),
    status: 'declined',
    createdAt: Timestamp.fromDate(DateTime(2026, 10, 15, 9, 0)),
  );

  group('CustomerEnquiriesScreen - State Rendering', () {
    testWidgets('1. Empty enquiry history renders clean empty state and CTA', (tester) async {
      await tester.pumpWidget(
        buildTestApp(
          const CustomerEnquiriesScreen(
            testCustomerId: 'cust_abc_123',
            enquiryStream: Stream<List<EnquiryModel>>.empty(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('MY ENQUIRIES'), findsOneWidget);
      expect(find.text('No Enquiries Yet'), findsOneWidget);
      expect(
        find.textContaining('You have not submitted any venue availability'),
        findsOneWidget,
      );
      expect(find.text('Explore Catalog'), findsOneWidget);
    });

    testWidgets('2. Populated history renders cards with venue, vendor, dates and badges', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final stream = Stream.value([
        sampleVendorEnquiry,
        sampleVenueEnquiry,
        sampleDeclinedEnquiry,
      ]);

      await tester.pumpWidget(
        buildTestApp(
          CustomerEnquiriesScreen(
            testCustomerId: 'cust_abc_123',
            enquiryStream: stream,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Check Header Titles
      expect(find.text('Royal Candid Studios'), findsOneWidget);
      expect(find.text('The Taj Lands End Ballroom'), findsOneWidget);
      expect(find.text('Floral Fantasy Decor'), findsOneWidget);

      // Check Status Badges
      expect(find.text('ACCEPTED'), findsOneWidget);
      expect(find.text('PENDING'), findsOneWidget);
      expect(find.text('DECLINED'), findsOneWidget);

      // Check Guest counts and messages
      expect(find.text('100 Guests'), findsOneWidget);
      expect(find.text('250 Guests'), findsOneWidget);
      expect(find.textContaining('candid photographers'), findsOneWidget);
      expect(find.textContaining('Grand Ballroom'), findsOneWidget);
    });

    testWidgets('3. Filter chips filter visible items client-side', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final stream = Stream.value([
        sampleVendorEnquiry,
        sampleVenueEnquiry,
        sampleDeclinedEnquiry,
      ]);

      await tester.pumpWidget(
        buildTestApp(
          CustomerEnquiriesScreen(
            testCustomerId: 'cust_abc_123',
            enquiryStream: stream,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Initially all 3 are visible
      expect(find.text('Royal Candid Studios'), findsOneWidget);
      expect(find.text('The Taj Lands End Ballroom'), findsOneWidget);
      expect(find.text('Floral Fantasy Decor'), findsOneWidget);

      // Tap 'Accepted' chip
      await tester.tap(find.text('Accepted'));
      await tester.pumpAndSettle();

      expect(find.text('Royal Candid Studios'), findsOneWidget);
      expect(find.text('The Taj Lands End Ballroom'), findsNothing);
      expect(find.text('Floral Fantasy Decor'), findsNothing);

      // Tap 'Declined' chip
      await tester.tap(find.text('Declined'));
      await tester.pumpAndSettle();

      expect(find.text('Floral Fantasy Decor'), findsOneWidget);
      expect(find.text('Royal Candid Studios'), findsNothing);
      expect(find.text('The Taj Lands End Ballroom'), findsNothing);

      // Tap 'All' chip
      await tester.tap(find.text('All'));
      await tester.pumpAndSettle();

      expect(find.text('Royal Candid Studios'), findsOneWidget);
      expect(find.text('The Taj Lands End Ballroom'), findsOneWidget);
    });

    testWidgets('4. Loading state displays indicator and message while waiting', (tester) async {
      final controller = StreamController<List<EnquiryModel>>();

      await tester.pumpWidget(
        buildTestApp(
          CustomerEnquiriesScreen(
            testCustomerId: 'cust_abc_123',
            enquiryStream: controller.stream,
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Loading your enquiries...'), findsOneWidget);

      await controller.close();
    });

    testWidgets('5. Error state displays error icon and message', (tester) async {
      final stream = Stream<List<EnquiryModel>>.error('Firestore network connection failed');

      await tester.pumpWidget(
        buildTestApp(
          CustomerEnquiriesScreen(
            testCustomerId: 'cust_abc_123',
            enquiryStream: stream,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.error_outline_rounded), findsOneWidget);
      expect(find.text('Unable to load enquiries'), findsOneWidget);
      expect(find.textContaining('Firestore network connection failed'), findsOneWidget);
    });

    testWidgets('6. Unauthenticated customer displays sign in required gate', (tester) async {
      await tester.pumpWidget(
        buildTestApp(
          const CustomerEnquiriesScreen(
            testCustomerId: '', // Empty or null customer ID
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sign In Required'), findsOneWidget);
      expect(
        find.textContaining('Please sign in to view your submitted enquiries'),
        findsOneWidget,
      );
      expect(find.text('Sign In'), findsOneWidget);
    });
  });

  group('CustomerEnquiries Navigation & Profile Integration', () {
    testWidgets('7. UserProfileView displays My Enquiries entry under My Activity', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      authStateNotifier.setTestRole('user');

      await tester.pumpWidget(
        buildTestApp(
          const Scaffold(
            body: UserProfileView(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('MY ACTIVITY'), findsOneWidget);
      expect(find.text('My Events'), findsOneWidget);
      expect(find.text('My Enquiries'), findsOneWidget);
      expect(
        find.text('Track vendor & venue availability requests'),
        findsOneWidget,
      );
    });

    test('8. EnquiriesRepository identity guard emits empty list for blank customer IDs', () async {
      final emptyResult = await EnquiriesRepository.streamCustomerEnquiries('').first;
      expect(emptyResult, isEmpty);

      final whitespaceResult = await EnquiriesRepository.streamCustomerEnquiries('   ').first;
      expect(whitespaceResult, isEmpty);
    });

    test('9. AppRouter registers /my-enquiries route for authenticated customers', () {
      final routes = appRouter.configuration.routes;
      final myEnquiriesRoute = routes
          .whereType<GoRoute>()
          .firstWhere((r) => r.path == '/my-enquiries', orElse: () => throw Exception('Route not found'));
      expect(myEnquiriesRoute.path, equals('/my-enquiries'));
    });
  });
}
