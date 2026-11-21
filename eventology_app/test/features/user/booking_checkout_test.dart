import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:eventology_app/features/user/bookings/screens/booking_checkout_screen.dart';
import 'package:eventology_app/features/user/bookings/screens/customer_bookings_screen.dart';
import 'package:eventology_app/models/bookings_model.dart';
import 'package:eventology_app/models/quotations_model.dart';
import 'package:eventology_app/services/payment_api_service.dart';
import 'package:eventology_app/services/quotation_api_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final sampleBooking = BookingModel(
    bookingId: 'bk_photo_123',
    eventId: 'evt_wedding_456',
    customerId: 'cust_alice_101',
    vendorId: 'vnd_lenscraft',
    serviceId: 'srv_photo_pkg',
    amount: 125000.0,
    amountInPaise: 12500000,
    currency: 'INR',
    quotationId: 'qt_lenscraft_789',
    enquiryId: 'enq_photo_001',
    status: 'confirmed',
    paymentStatus: 'unpaid',
    bookingDate: Timestamp.fromDate(DateTime.parse('2026-11-15T10:00:00.000Z')),
    createdAt: Timestamp.fromDate(DateTime.parse('2026-10-28T10:00:00.000Z')),
  );

  final sampleQuotation = QuotationModel(
    quotationId: 'qt_lenscraft_789',
    enquiryId: 'enq_photo_001',
    vendorId: 'vnd_lenscraft',
    customerId: 'cust_alice_101',
    eventId: 'evt_wedding_456',
    serviceId: 'srv_photo_pkg',
    currency: 'INR',
    lineItems: const [
      QuotationLineItemModel(
        description: 'Full Day Cinematic Wedding Coverage',
        quantity: 1,
        unitPricePaise: 10000000, // ₹1,00,000
        totalPaise: 10000000,
      ),
      QuotationLineItemModel(
        description: 'Premium Leather Album',
        quantity: 1,
        unitPricePaise: 2500000, // ₹25,000
        totalPaise: 2500000,
      ),
    ],
    subtotalPaise: 12500000,
    taxPaise: 0,
    totalAmountPaise: 12500000,
    validUntil: DateTime.parse('2026-11-05T23:59:59.000Z'),
    status: 'accepted',
    bookingId: 'bk_photo_123',
    submittedBy: 'vendor_lenscraft',
    inclusions: const ['Raw high-res footage', 'Color grading included'],
    exclusions: const ['Accommodation for destination shoots'],
    notes: 'Advance booking confirmed via accepted quotation.',
    createdAt: DateTime.parse('2026-10-28T09:00:00.000Z'),
    updatedAt: DateTime.parse('2026-10-28T09:30:00.000Z'),
  );

  Map<String, dynamic> sampleQuotationJson() {
    return {
      'quotationId': sampleQuotation.quotationId,
      'enquiryId': sampleQuotation.enquiryId,
      'eventId': sampleQuotation.eventId,
      'customerId': sampleQuotation.customerId,
      'vendorId': sampleQuotation.vendorId,
      'serviceId': sampleQuotation.serviceId,
      'currency': sampleQuotation.currency,
      'lineItems': sampleQuotation.lineItems.map((e) => e.toMap()).toList(),
      'subtotalPaise': sampleQuotation.subtotalPaise,
      'taxPaise': sampleQuotation.taxPaise,
      'totalAmountPaise': sampleQuotation.totalAmountPaise,
      'validUntil': sampleQuotation.validUntil.toIso8601String(),
      'status': sampleQuotation.status,
      'bookingId': sampleQuotation.bookingId,
      'submittedBy': sampleQuotation.submittedBy,
      'inclusions': sampleQuotation.inclusions,
      'exclusions': sampleQuotation.exclusions,
      'notes': sampleQuotation.notes,
      'createdAt': sampleQuotation.createdAt.toIso8601String(),
      'updatedAt': sampleQuotation.updatedAt.toIso8601String(),
    };
  }

  Widget buildTestWidget({
    required BookingModel booking,
    PaymentApiService? paymentApi,
    QuotationApiService? quotationApi,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: BookingCheckoutScreen(
          bookingId: booking.id,
          initialBooking: booking,
          paymentApiService: paymentApi,
          quotationApiService: quotationApi,
        ),
      ),
    );
  }

  group('BookingCheckoutScreen - UI & Financial Breakdown', () {
    testWidgets('1. Displays agreed quotation breakdown, line items, and amount due', (tester) async {
      final mockQuotationClient = MockClient((request) async {
        if (request.url.path.endsWith('/quotations/qt_lenscraft_789')) {
          return http.Response(jsonEncode({'quotation': sampleQuotationJson()}), 200);
        }
        return http.Response(jsonEncode({'error': 'Not found'}), 404);
      });

      final mockPaymentClient = MockClient((request) async {
        return http.Response(jsonEncode({'payments': []}), 200);
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
        buildTestWidget(
          booking: sampleBooking,
          paymentApi: paymentApi,
          quotationApi: quotationApi,
        ),
      );

      await tester.pumpAndSettle();

      // Invariant: Header shows booking reference
      expect(find.text('BOOKING CHECKOUT'), findsOneWidget);
      expect(find.text('Booking #BK_PHOTO'), findsOneWidget);
      expect(find.text('PAYMENT DUE'), findsOneWidget);

      // Invariant: Exact itemized line items appear
      expect(find.text('Full Day Cinematic Wedding Coverage'), findsOneWidget);
      expect(find.text('Premium Leather Album'), findsOneWidget);

      // Invariant: Inclusions rendered
      expect(find.textContaining('Raw high-res footage'), findsOneWidget);

      // Invariant: Agreed total and amount due match quotation
      expect(find.text('₹1,25,000.00'), findsAtLeast(2)); // Subtotal, Total and Due

      // Invariant: Accurate payment & settlement disclosure is displayed
      expect(find.text('Payment & Settlement Disclosure'), findsOneWidget);
      expect(find.textContaining('Verification Status'), findsOneWidget);
      expect(find.textContaining('Sandbox Simulation vs Real Money'), findsOneWidget);
      expect(find.textContaining('Settlement Ledger'), findsOneWidget);
      expect(find.textContaining('External Disbursement'), findsOneWidget);

      // Invariant: Regression check - no unsupported escrow or platform-holding claims
      expect(find.textContaining('Escrow Protection'), findsNothing);
      expect(find.textContaining('held on the Eventology'), findsNothing);

      // Invariant: Checkout button is enabled with exact formatted amount
      expect(find.byKey(const Key('initiate_checkout_button')), findsOneWidget);
      expect(find.textContaining('Pay Now via Razorpay (₹1,25,000.00)'), findsOneWidget);
    });

    testWidgets('2. Displays PAID state when booking is already confirmed and paid', (tester) async {
      final paidBooking = sampleBooking.copyWith(paymentStatus: 'paid');

      final mockQuotationClient = MockClient((request) async {
        return http.Response(jsonEncode({'quotation': sampleQuotationJson()}), 200);
      });

      final mockPaymentClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'transactionId': 'pay_sim_success_999',
            'paymentId': 'pay_sim_success_999',
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
        buildTestWidget(
          booking: paidBooking,
          paymentApi: paymentApi,
          quotationApi: quotationApi,
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('PAID'), findsOneWidget);
      expect(find.textContaining('PAYMENT CONFIRMED'), findsOneWidget);
      expect(find.text('Payment Verified & Recorded on Ledger'), findsOneWidget);
      expect(find.textContaining('Transaction ID: pay_sim_success_999'), findsOneWidget);
      expect(find.byKey(const Key('initiate_checkout_button')), findsNothing);
    });
  });

  group('BookingCheckoutScreen - Interactive Payment Flow', () {
    testWidgets('3. Simulates successful sandbox payment and transitions to paid state', (tester) async {
      final mockQuotationClient = MockClient((request) async {
        return http.Response(jsonEncode({'quotation': sampleQuotationJson()}), 200);
      });

      var verifyCalled = false;

      final mockPaymentClient = MockClient((request) async {
        final path = request.url.path;

        if (path.endsWith('/create-order')) {
          return http.Response(
            jsonEncode({
              'orderId': 'order_rzp_mock_123',
              'paymentId': 'pay_doc_456',
              'amount': 12500000,
              'currency': 'INR',
              'isTestMode': true,
            }),
            200,
          );
        } else if (path.endsWith('/sandbox-simulate-payment')) {
          return http.Response(
            jsonEncode({
              'razorpay_order_id': 'order_rzp_mock_123',
              'razorpay_payment_id': 'pay_sim_999888',
              'razorpay_signature': 'valid_mock_signature_hash',
            }),
            200,
          );
        } else if (path.endsWith('/verify')) {
          verifyCalled = true;
          final body = jsonDecode(request.body);
          expect(body['razorpay_order_id'], 'order_rzp_mock_123');
          expect(body['razorpay_payment_id'], 'pay_sim_999888');
          expect(body['razorpay_signature'], 'valid_mock_signature_hash');
          return http.Response(
            jsonEncode({
              'success': true,
              'message': 'Payment verified successfully.',
            }),
            200,
          );
        } else if (path.contains('/booking/')) {
          return http.Response(
            jsonEncode({
              'transactionId': 'pay_sim_999888',
              'status': 'paid',
              'amount': 125000,
              'paymentMethod': 'razorpay',
            }),
            200,
          );
        }

        return http.Response(jsonEncode({'error': 'Unhandled path: $path'}), 404);
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
        buildTestWidget(
          booking: sampleBooking,
          paymentApi: paymentApi,
          quotationApi: quotationApi,
        ),
      );

      await tester.pumpAndSettle();

      // Tap Initiate Checkout
      final payBtn = find.byKey(const Key('initiate_checkout_button'));
      expect(payBtn, findsOneWidget);
      await tester.tap(payBtn);
      await tester.pumpAndSettle();

      // Sandbox Test Double Modal is open
      expect(find.text('Razorpay Secure Checkout'), findsOneWidget);
      expect(find.text('Order Reference: order_rzp_mock_123'), findsOneWidget);

      // Tap "Complete Payment (₹1,25,000.00)"
      final successBtn = find.byKey(const Key('simulate_checkout_success_btn'));
      expect(successBtn, findsOneWidget);
      await tester.tap(successBtn);
      await tester.pumpAndSettle();

      // Assert verify endpoint was invoked
      expect(verifyCalled, isTrue);

      // Assert UI transitioned to paid banner and synchronized state
      expect(find.text('PAID'), findsOneWidget);
      expect(find.textContaining('Payment verified & confirmed!'), findsOneWidget);
    });

    testWidgets('4. Simulates declined sandbox payment and maintains unpaid state with error message', (tester) async {
      final mockQuotationClient = MockClient((request) async {
        return http.Response(jsonEncode({'quotation': sampleQuotationJson()}), 200);
      });

      var failureSimulated = false;

      final mockPaymentClient = MockClient((request) async {
        final path = request.url.path;

        if (path.endsWith('/create-order')) {
          return http.Response(
            jsonEncode({
              'orderId': 'order_rzp_mock_fail',
              'paymentId': 'pay_doc_fail',
              'amount': 12500000,
              'currency': 'INR',
              'isTestMode': true,
            }),
            200,
          );
        } else if (path.endsWith('/sandbox-simulate-failure')) {
          failureSimulated = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'status': 'failed',
              'message': 'Recorded payment failure.',
            }),
            200,
          );
        } else if (path.contains('/booking/')) {
          return http.Response(jsonEncode({'payments': []}), 200);
        }

        return http.Response(jsonEncode({'error': 'Unhandled path: $path'}), 404);
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
        buildTestWidget(
          booking: sampleBooking,
          paymentApi: paymentApi,
          quotationApi: quotationApi,
        ),
      );

      await tester.pumpAndSettle();

      // Tap Initiate Checkout
      await tester.tap(find.byKey(const Key('initiate_checkout_button')));
      await tester.pumpAndSettle();

      // Tap "Simulate Decline"
      final declineBtn = find.byKey(const Key('simulate_checkout_decline_btn'));
      expect(declineBtn, findsOneWidget);
      await tester.tap(declineBtn);
      await tester.pumpAndSettle();

      expect(failureSimulated, isTrue);

      // Invariant: Error banner is shown and booking remains unpaid
      expect(find.textContaining('Payment declined'), findsOneWidget);
      expect(find.text('PAYMENT DUE'), findsOneWidget);
      expect(find.byKey(const Key('initiate_checkout_button')), findsOneWidget);
    });

    testWidgets('5. Cancelling checkout leaves booking unpaid without false success', (tester) async {
      final mockQuotationClient = MockClient((request) async {
        return http.Response(jsonEncode({'quotation': sampleQuotationJson()}), 200);
      });

      final mockPaymentClient = MockClient((request) async {
        final path = request.url.path;
        if (path.endsWith('/create-order')) {
          return http.Response(
            jsonEncode({
              'orderId': 'order_rzp_mock_cancel',
              'paymentId': 'pay_doc_cancel',
              'amount': 12500000,
              'currency': 'INR',
              'isTestMode': true,
            }),
            200,
          );
        } else if (path.contains('/booking/')) {
          return http.Response(jsonEncode({'payments': []}), 200);
        }
        return http.Response(jsonEncode({'error': 'Unhandled path: $path'}), 404);
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
        buildTestWidget(
          booking: sampleBooking,
          paymentApi: paymentApi,
          quotationApi: quotationApi,
        ),
      );

      await tester.pumpAndSettle();

      // Open modal
      await tester.tap(find.byKey(const Key('initiate_checkout_button')));
      await tester.pumpAndSettle();

      // Tap Cancel button in dialog
      final cancelBtn = find.byKey(const Key('cancel_checkout_btn'));
      expect(cancelBtn, findsOneWidget);
      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();

      // Modal closed, cancellation banner shown
      expect(find.byKey(const Key('simulate_checkout_success_btn')), findsNothing);
      expect(find.textContaining('Checkout was cancelled by user'), findsOneWidget);
      expect(find.text('PAYMENT DUE'), findsOneWidget);
      expect(find.byKey(const Key('initiate_checkout_button')), findsOneWidget);
    });
  });

  group('CustomerBookingsScreen - Filtering & Management', () {
    testWidgets('6. Renders My Bookings tabs and displays customer bookings', (tester) async {
      final unpaid = sampleBooking;
      final paid = sampleBooking.copyWith(
        bookingId: 'bk_decor_456',
        vendorId: 'vnd_floralmagic',
        amount: 80000.0,
        amountInPaise: 8000000,
        paymentStatus: 'paid',
      );

      final stream = Stream.value([unpaid, paid]);

      await tester.pumpWidget(
        MaterialApp(
          home: CustomerBookingsScreen(
            bookingStream: stream,
            testCustomerId: 'cust_alice_101',
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('MY BOOKINGS'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Payment Due'), findsOneWidget);
      expect(find.text('Paid'), findsOneWidget);

      // Both bookings visible on All tab
      expect(find.text('Booking #BK_PHOTO'), findsOneWidget);
      expect(find.text('Booking #BK_DECOR'), findsOneWidget);
      expect(find.textContaining('Checkout & Pay'), findsOneWidget);
      expect(find.text('View Invoice & Receipt'), findsOneWidget);

      // Switch to Payment Due tab
      await tester.tap(find.text('Payment Due'));
      await tester.pumpAndSettle();

      expect(find.text('Booking #BK_PHOTO'), findsOneWidget);
      expect(find.text('Booking #BK_DECOR'), findsNothing);

      // Switch to Paid tab
      await tester.tap(find.text('Paid'));
      await tester.pumpAndSettle();

      expect(find.text('Booking #BK_PHOTO'), findsNothing);
      expect(find.text('Booking #BK_DECOR'), findsOneWidget);
    });

    testWidgets('7. Displays empty state when no bookings exist for the selected tab', (tester) async {
      final stream = Stream.value(<BookingModel>[]);

      await tester.pumpWidget(
        MaterialApp(
          home: CustomerBookingsScreen(
            bookingStream: stream,
            testCustomerId: 'cust_alice_101',
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No Bookings Yet'), findsOneWidget);
    });
  });
}
