import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eventology_app/models/bookings_model.dart';
import 'package:eventology_app/services/fulfillment_api_service.dart';
import 'package:eventology_app/features/vendor/bookings/vendor_bookings_view.dart';
import 'package:eventology_app/features/user/bookings/screens/booking_checkout_screen.dart';
import 'package:eventology_app/services/payment_api_service.dart';
import 'package:eventology_app/services/quotation_api_service.dart';

void main() {
  final now = Timestamp.now();

  final paidConfirmedBooking = BookingModel(
    bookingId: 'bk_vendor_01',
    eventId: 'event_wedding_99',
    customerId: 'cust_alice_101',
    vendorId: 'v_photo_01',
    serviceId: 'srv_cinematography',
    amount: 125000,
    amountInPaise: 12500000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentStatus: 'confirmed',
    fulfillmentMilestones: [],
    bookingDate: now,
    createdAt: now,
  );

  final unpaidBooking = BookingModel(
    bookingId: 'bk_vendor_unpaid',
    eventId: 'event_wedding_99',
    customerId: 'cust_alice_101',
    vendorId: 'v_photo_01',
    serviceId: 'srv_cinematography',
    amount: 50000,
    amountInPaise: 5000000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'unpaid',
    fulfillmentStatus: 'confirmed',
    fulfillmentMilestones: [],
    bookingDate: now,
    createdAt: now,
  );

  final deliveredBooking = BookingModel(
    bookingId: 'bk_vendor_delivered',
    eventId: 'event_wedding_99',
    customerId: 'cust_alice_101',
    vendorId: 'v_photo_01',
    serviceId: 'srv_cinematography',
    amount: 125000,
    amountInPaise: 12500000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentStatus: 'delivered',
    fulfillmentMilestones: [
      {'milestone': 'prep_started', 'notes': 'Gear tested'},
      {'milestone': 'delivered', 'notes': 'Event ceremony cinematographed'},
    ],
    bookingDate: now,
    createdAt: now,
  );

  final reviewPendingBooking = BookingModel(
    bookingId: 'bk_vendor_review',
    eventId: 'event_wedding_99',
    customerId: 'cust_alice_101',
    vendorId: 'v_photo_01',
    serviceId: 'srv_cinematography',
    amount: 125000,
    amountInPaise: 12500000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentStatus: 'review_pending',
    fulfillmentMilestones: [],
    bookingDate: now,
    createdAt: now,
  );

  final rejectedBooking = BookingModel(
    bookingId: 'bk_vendor_rejected',
    eventId: 'event_wedding_99',
    customerId: 'cust_alice_101',
    vendorId: 'v_photo_01',
    serviceId: 'srv_cinematography',
    amount: 125000,
    amountInPaise: 12500000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentStatus: 'rejected',
    completionReview: {
      'approved': false,
      'reason': 'Wrap photos missing stage lighting handover.',
    },
    fulfillmentMilestones: [],
    bookingDate: now,
    createdAt: now,
  );

  final completedBooking = BookingModel(
    bookingId: 'bk_vendor_completed',
    eventId: 'event_wedding_99',
    customerId: 'cust_alice_101',
    vendorId: 'v_photo_01',
    serviceId: 'srv_cinematography',
    amount: 125000,
    amountInPaise: 12500000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'paid',
    fulfillmentStatus: 'completed',
    fulfillmentMilestones: [],
    bookingDate: now,
    createdAt: now,
  );

  Widget buildVendorView({
    required List<BookingModel> bookings,
    FulfillmentApiService? api,
  }) {
    return MaterialApp(
      home: VendorBookingsView(
        bookingsStream: Stream.value(bookings),
        fulfillmentApi: api,
      ),
    );
  }

  group('Vendor Fulfillment UI & Milestone Tracking', () {
    testWidgets('1. Renders vendor bookings with fulfillment badge and unpaid notice', (tester) async {
      await tester.pumpWidget(
        buildVendorView(bookings: [paidConfirmedBooking, unpaidBooking]),
      );
      await tester.pumpAndSettle();

      expect(find.text('Service Delivery & Fulfillment'), findsOneWidget);
      expect(find.text('CONFIRMED'), findsAtLeast(2));
      expect(find.text('PAID'), findsOneWidget);
      expect(find.text('UNPAID'), findsOneWidget);

      // Unpaid notice is rendered
      expect(
        find.text('Awaiting customer payment before commencing fulfillment.'),
        findsOneWidget,
      );

      // Paid booking has milestone action button
      expect(find.text('Start Preparation'), findsOneWidget);
    });

    testWidgets('2. Filters bookings by status tabs correctly', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        buildVendorView(bookings: [
          paidConfirmedBooking,
          unpaidBooking,
          reviewPendingBooking,
          completedBooking,
        ]),
      );
      await tester.pumpAndSettle();

      // Default: All shows all 4
      expect(find.byKey(const Key('booking_card_bk_vendor_01')), findsOneWidget);
      expect(find.byKey(const Key('booking_card_bk_vendor_unpaid')), findsOneWidget);
      expect(find.byKey(const Key('booking_card_bk_vendor_review')), findsOneWidget);
      expect(find.byKey(const Key('booking_card_bk_vendor_completed')), findsOneWidget);

      // Tap 'Review Pending' tab
      await tester.tap(find.byKey(const Key('filter_tab_review_pending')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('booking_card_bk_vendor_review')), findsOneWidget);
      expect(find.byKey(const Key('booking_card_bk_vendor_01')), findsNothing);
      expect(find.byKey(const Key('booking_card_bk_vendor_unpaid')), findsNothing);

      // Tap 'Completed' tab
      await tester.ensureVisible(find.byKey(const Key('filter_tab_completed')));
      await tester.tap(find.byKey(const Key('filter_tab_completed')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('booking_card_bk_vendor_completed')), findsOneWidget);
      expect(find.byKey(const Key('booking_card_bk_vendor_review')), findsNothing);

      // Tap 'Unpaid' tab
      await tester.ensureVisible(find.byKey(const Key('filter_tab_unpaid')));
      await tester.tap(find.byKey(const Key('filter_tab_unpaid')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('booking_card_bk_vendor_unpaid')), findsOneWidget);
      expect(find.byKey(const Key('booking_card_bk_vendor_completed')), findsNothing);
    });

    testWidgets('3. Advances milestone when vendor taps action button', (tester) async {
      var milestoneUpdated = false;
      var updatedMilestone = '';

      final mockClient = MockClient((req) async {
        if (req.url.path.contains('/milestone')) {
          milestoneUpdated = true;
          final body = jsonDecode(req.body);
          updatedMilestone = body['milestone'];
          return http.Response(
            jsonEncode({'success': true, 'fulfillmentStatus': updatedMilestone, 'isExisting': false}),
            200,
          );
        }
        return http.Response('{"error":"not found"}', 404);
      });

      final api = FulfillmentApiService(
        client: mockClient,
        tokenProvider: () async => 'test_token',
      );

      await tester.pumpWidget(
        buildVendorView(bookings: [paidConfirmedBooking], api: api),
      );
      await tester.pumpAndSettle();

      expect(find.text('Start Preparation'), findsOneWidget);
      await tester.tap(find.text('Start Preparation'));
      await tester.pumpAndSettle();

      expect(milestoneUpdated, true);
      expect(updatedMilestone, 'prep_started');
      expect(find.text('Milestone updated to prep started.'), findsOneWidget);
    });

    testWidgets('4. Submits completion evidence via dialog with validation', (tester) async {
      var submitted = false;
      String submittedNotes = '';
      List<dynamic> submittedChecklist = [];

      final mockClient = MockClient((req) async {
        if (req.url.path.contains('/submit-completion')) {
          submitted = true;
          final body = jsonDecode(req.body);
          submittedNotes = body['notes'];
          submittedChecklist = body['checklistCompleted'];
          return http.Response(
            jsonEncode({'success': true, 'fulfillmentStatus': 'review_pending', 'isExisting': false}),
            200,
          );
        }
        return http.Response('{"error":"not found"}', 404);
      });

      final api = FulfillmentApiService(
        client: mockClient,
        tokenProvider: () async => 'test_token',
      );

      await tester.pumpWidget(
        buildVendorView(bookings: [deliveredBooking], api: api),
      );
      await tester.pumpAndSettle();

      // Delivered status shows "Submit Completion Evidence" button
      expect(find.text('Submit Completion Evidence'), findsOneWidget);
      await tester.tap(find.text('Submit Completion Evidence'));
      await tester.pumpAndSettle();

      // Completion dialog appears
      expect(find.text('Submit Completion Evidence'), findsAtLeast(1));
      expect(find.byKey(const Key('completion_notes_input')), findsOneWidget);

      // Attempt submit without notes -> validation snackbar
      await tester.tap(find.byKey(const Key('submit_evidence_action_button')));
      await tester.pumpAndSettle();
      expect(find.text('Please enter delivery notes before submitting.'), findsOneWidget);
      expect(submitted, false);

      // Fill in notes and toggle checklist
      await tester.enterText(
        find.byKey(const Key('completion_notes_input')),
        'All 4K video reels delivered, raw master hard drive handed over to event organizer.',
      );
      await tester.tap(find.text('Scope delivered per agreed quotation'));
      await tester.pumpAndSettle();

      // Submit
      await tester.tap(find.byKey(const Key('submit_evidence_action_button')));
      await tester.pumpAndSettle();

      expect(submitted, true);
      expect(submittedNotes, contains('raw master hard drive'));
      expect(submittedChecklist, contains('Scope delivered per agreed quotation'));
      expect(
        find.text('Completion evidence submitted for administrative review.'),
        findsOneWidget,
      );
    });

    testWidgets('5. Displays rejection notice with admin reason and resubmit action', (tester) async {
      await tester.pumpWidget(
        buildVendorView(bookings: [rejectedBooking]),
      );
      await tester.pumpAndSettle();

      expect(find.text('REJECTED'), findsOneWidget);
      expect(find.text('Completion Rejected by Admin'), findsOneWidget);
      expect(find.textContaining('Wrap photos missing stage lighting handover.'), findsOneWidget);
      expect(find.byKey(const Key('resubmit_evidence_button_bk_vendor_rejected')), findsOneWidget);
    });

    testWidgets('6. Displays verified settlement eligibility notice on completed booking', (tester) async {
      await tester.pumpWidget(
        buildVendorView(bookings: [completedBooking]),
      );
      await tester.pumpAndSettle();

      expect(find.text('COMPLETED'), findsOneWidget);
      expect(
        find.text('Service delivery approved. Eligible for administrative settlement review.'),
        findsOneWidget,
      );
    });
  });

  group('Customer Visibility - Service Delivery Progress', () {
    testWidgets('7. Customer booking checkout screen displays delivery progress stepper & activity log', (tester) async {
      final mockQuotationClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'quotation': {
              'quotationId': 'q_test_1',
              'enquiryId': 'enq_1',
              'vendorId': 'v_photo_01',
              'customerId': 'cust_alice_101',
              'eventId': 'event_wedding_99',
              'status': 'accepted',
              'totalAmountPaise': 12500000,
              'lineItems': [
                {
                  'title': 'Cinematography Full Day',
                  'quantity': 1,
                  'unitPricePaise': 12500000,
                  'lineTotalPaise': 12500000,
                }
              ],
            }
          }),
          200,
        );
      });

      final mockPaymentClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'transactionId': 'pay_sim_999',
            'paymentId': 'pay_sim_999',
            'status': 'paid',
            'amount': 125000,
            'paymentMethod': 'razorpay',
          }),
          200,
        );
      });

      final quotationApi = QuotationApiService(
        client: mockQuotationClient,
        tokenProvider: () async => 'test_token',
      );
      final paymentApi = PaymentApiService(
        client: mockPaymentClient,
        tokenProvider: () async => 'test_token',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: BookingCheckoutScreen(
            bookingId: deliveredBooking.id,
            initialBooking: deliveredBooking,
            quotationApiService: quotationApi,
            paymentApiService: paymentApi,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Customer sees delivery progress card
      expect(find.byKey(const Key('customer_delivery_progress_card')), findsOneWidget);
      expect(find.text('SERVICE DELIVERY PROGRESS'), findsOneWidget);
      expect(find.text('DELIVERED'), findsAtLeast(1));

      // Stepper stages are visible
      expect(find.text('Preparation'), findsOneWidget);
      expect(find.text('Setup'), findsOneWidget);
      expect(find.text('Delivered'), findsOneWidget);
      expect(find.text('Verified'), findsOneWidget);

      // Milestone activity log rendered
      expect(find.text('Milestone Activity Log'), findsOneWidget);
      expect(find.textContaining('PREP STARTED: Gear tested'), findsOneWidget);
      expect(find.textContaining('DELIVERED: Event ceremony cinematographed'), findsOneWidget);
    });
  });
}
