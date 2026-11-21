import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:eventology_app/models/bookings_model.dart';
import 'package:eventology_app/models/cancellation_model.dart';
import 'package:eventology_app/services/cancellation_api_service.dart';
import 'package:eventology_app/features/user/bookings/widgets/cancellation_dialogs.dart';
import 'package:eventology_app/features/user/bookings/screens/customer_bookings_screen.dart';
import 'package:eventology_app/features/admin/admin_cancellation_queue_tab.dart';

class MockCancellationApiService extends CancellationApiService {
  final Future<CancellationCalculationModel> Function(String bookingId)? onFetchEstimate;
  final Future<CancellationRequestModel> Function({
    required String bookingId,
    required String reason,
    String? customerNotes,
  })? onRequestCancellation;
  final Future<CancellationRequestModel?> Function(String bookingId)? onFetchByBooking;
  final Future<CancellationRequestModel> Function(String requestId)? onWithdraw;
  final Future<List<CancellationRequestModel>> Function({String? status, int? limit})? onFetchAdminQueue;
  final Future<CancellationRequestModel> Function({
    required String requestId,
    required String decisionReason,
    String? adminInternalNotes,
    required String refundDecision,
    int? approvedRefundPaise,
  })? onApprove;
  final Future<CancellationRequestModel> Function({
    required String requestId,
    required String decisionReason,
    String? adminInternalNotes,
  })? onReject;
  final Future<Map<String, dynamic>> Function(String requestId)? onExecuteRefund;

  MockCancellationApiService({
    this.onFetchEstimate,
    this.onRequestCancellation,
    this.onFetchByBooking,
    this.onWithdraw,
    this.onFetchAdminQueue,
    this.onApprove,
    this.onReject,
    this.onExecuteRefund,
  });

  @override
  Future<CancellationCalculationModel> fetchEstimate(String bookingId) async {
    if (onFetchEstimate != null) return await onFetchEstimate!(bookingId);
    return const CancellationCalculationModel(
      policyVersion: 'POL-CAN-2026-V1',
      windowTier: 'standard_pre_event',
      grossPaidPaise: 5000000,
      deductionBps: 500,
      deductionPaise: 250000,
      refundEstimatePaise: 4750000,
      isCustomReviewRequired: false,
      rationale: 'Standard Pre-Event Window (> 14 days). 5% deduction, 95% refund estimate.',
    );
  }

  @override
  Future<CancellationRequestModel> requestCancellation({
    required String bookingId,
    required String reason,
    String? customerNotes,
  }) async {
    if (onRequestCancellation != null) {
      return await onRequestCancellation!(
        bookingId: bookingId,
        reason: reason,
        customerNotes: customerNotes,
      );
    }
    return CancellationRequestModel(
      requestId: 'req_test_101',
      bookingId: bookingId,
      eventId: 'evt_01',
      customerId: 'cust_01',
      vendorId: 'vnd_01',
      cancellationStatus: 'cancellation_requested',
      refundStatus: 'refund_pending_review',
      reason: reason,
      customerNotes: customerNotes,
      calculation: const CancellationCalculationModel(
        policyVersion: 'POL-CAN-2026-V1',
        windowTier: 'standard_pre_event',
        grossPaidPaise: 5000000,
        deductionBps: 500,
        deductionPaise: 250000,
        refundEstimatePaise: 4750000,
        isCustomReviewRequired: false,
        rationale: 'Standard Pre-Event Window',
      ),
    );
  }

  @override
  Future<CancellationRequestModel?> fetchCancellationByBooking(String bookingId) async {
    if (onFetchByBooking != null) return await onFetchByBooking!(bookingId);
    return null;
  }

  @override
  Future<CancellationRequestModel> withdrawCancellation(String requestId) async {
    if (onWithdraw != null) return await onWithdraw!(requestId);
    throw UnimplementedError();
  }

  @override
  Future<List<CancellationRequestModel>> fetchAdminQueue({String? status, int? limit}) async {
    if (onFetchAdminQueue != null) return await onFetchAdminQueue!(status: status, limit: limit);
    return [];
  }

  @override
  Future<CancellationRequestModel> approveCancellation({
    required String requestId,
    required String decisionReason,
    String? adminInternalNotes,
    required String refundDecision,
    int? approvedRefundPaise,
  }) async {
    if (onApprove != null) {
      return await onApprove!(
        requestId: requestId,
        decisionReason: decisionReason,
        adminInternalNotes: adminInternalNotes,
        refundDecision: refundDecision,
        approvedRefundPaise: approvedRefundPaise,
      );
    }
    throw UnimplementedError();
  }

  @override
  Future<CancellationRequestModel> rejectCancellation({
    required String requestId,
    required String decisionReason,
    String? adminInternalNotes,
  }) async {
    if (onReject != null) {
      return await onReject!(
        requestId: requestId,
        decisionReason: decisionReason,
        adminInternalNotes: adminInternalNotes,
      );
    }
    throw UnimplementedError();
  }

  @override
  Future<Map<String, dynamic>> executeRefund(String requestId) async {
    if (onExecuteRefund != null) return await onExecuteRefund!(requestId);
    return {'success': true};
  }
}

void main() {
  void configureViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(1200, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
  }

  final sampleBooking = BookingModel(
    bookingId: 'bk_cancellation_test',
    eventId: 'evt_sample_01',
    customerId: 'cust_alice_101',
    vendorId: 'vnd_sample_vendor',
    serviceId: 'srv_photography',
    amount: 50000.0,
    amountInPaise: 5000000,
    currency: 'INR',
    status: 'confirmed',
    paymentStatus: 'paid',
    bookingDate: Timestamp.now(),
    createdAt: Timestamp.now(),
  );

  group('Customer Cancellation Request Dialog Tests', () {
    testWidgets('1. Loads policy estimate and renders breakdown with gross, deduction, and estimate', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerCancellationRequestDialog(
              booking: sampleBooking,
              apiService: MockCancellationApiService(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Request Cancellation'), findsOneWidget);
      expect(find.text('Commercial Policy Assessment'), findsOneWidget);
      expect(find.text('POL-CAN-2026-V1'), findsOneWidget);
      expect(find.text('₹50,000.00'), findsOneWidget); // Gross
      expect(find.text('- ₹2,500.00'), findsOneWidget); // 5% deduction
      expect(find.text('₹47,500.00'), findsOneWidget); // 95% refund estimate
      expect(find.byKey(const Key('submit_cancellation_btn')), findsOneWidget);
    });

    testWidgets('2. Disables confirm button when reason is under 5 characters', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerCancellationRequestDialog(
              booking: sampleBooking,
              apiService: MockCancellationApiService(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final submitBtn = tester.widget<ElevatedButton>(find.byKey(const Key('submit_cancellation_btn')));
      expect(submitBtn.onPressed, isNull);

      // Enter short reason
      await tester.enterText(find.byKey(const Key('cancellation_reason_input')), 'sick');
      await tester.pump();

      final submitBtnStillDisabled = tester.widget<ElevatedButton>(find.byKey(const Key('submit_cancellation_btn')));
      expect(submitBtnStillDisabled.onPressed, isNull);

      // Enter valid reason >= 5 characters
      await tester.enterText(find.byKey(const Key('cancellation_reason_input')), 'Family emergency occurred');
      await tester.pump();

      final submitBtnEnabled = tester.widget<ElevatedButton>(find.byKey(const Key('submit_cancellation_btn')));
      expect(submitBtnEnabled.onPressed, isNotNull);
    });

    testWidgets('3. Submits cancellation request and invokes callback on success', (tester) async {
      configureViewport(tester);
      bool submitted = false;
      bool callbackInvoked = false;

      final mockApi = MockCancellationApiService(
        onRequestCancellation: ({required bookingId, required reason, customerNotes}) async {
          submitted = true;
          expect(bookingId, 'bk_cancellation_test');
          expect(reason, 'Change of event date');
          return CancellationRequestModel(
            requestId: 'req_success_01',
            bookingId: bookingId,
            eventId: 'evt_01',
            customerId: 'cust_01',
            vendorId: 'vnd_01',
            cancellationStatus: 'cancellation_requested',
            refundStatus: 'refund_pending_review',
            reason: reason,
            calculation: const CancellationCalculationModel(
              policyVersion: 'POL-CAN-2026-V1',
              windowTier: 'standard_pre_event',
              grossPaidPaise: 5000000,
              deductionBps: 500,
              deductionPaise: 250000,
              refundEstimatePaise: 4750000,
              isCustomReviewRequired: false,
              rationale: 'Standard Pre-Event',
            ),
          );
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerCancellationRequestDialog(
              booking: sampleBooking,
              apiService: mockApi,
              onSuccess: () => callbackInvoked = true,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('cancellation_reason_input')), 'Change of event date');
      await tester.pump();

      await tester.tap(find.byKey(const Key('submit_cancellation_btn')));
      await tester.pumpAndSettle();

      expect(submitted, isTrue);
      expect(callbackInvoked, isTrue);
    });
  });

  group('Customer Cancellation Status Modal Tests', () {
    final sampleRequest = CancellationRequestModel(
      requestId: 'req_modal_01',
      bookingId: 'bk_cancellation_test',
      eventId: 'evt_sample_01',
      customerId: 'cust_alice_101',
      vendorId: 'vnd_sample_vendor',
      cancellationStatus: 'cancellation_requested',
      refundStatus: 'refund_pending_review',
      reason: 'Scheduling clash with family function',
      calculation: const CancellationCalculationModel(
        policyVersion: 'POL-CAN-2026-V1',
        windowTier: 'standard_pre_event',
        grossPaidPaise: 5000000,
        deductionBps: 500,
        deductionPaise: 250000,
        refundEstimatePaise: 4750000,
        isCustomReviewRequired: false,
        rationale: 'Standard Pre-Event',
      ),
    );

    testWidgets('4. Displays pending status and withdraw button allows cancellation withdrawal', (tester) async {
      configureViewport(tester);
      bool withdrawn = false;

      final mockApi = MockCancellationApiService(
        onWithdraw: (requestId) async {
          withdrawn = true;
          return sampleRequest;
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerCancellationStatusModal(
              request: sampleRequest,
              apiService: mockApi,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Cancellation & Refund Status'), findsOneWidget);
      expect(find.text('Pending Administrative Review'), findsOneWidget);
      expect(find.text('₹50,000.00'), findsOneWidget);
      expect(find.text('Withdraw Cancellation Request'), findsOneWidget);

      // Tap withdraw
      await tester.tap(find.byKey(const Key('withdraw_cancellation_btn')));
      await tester.pumpAndSettle();

      // Confirmation dialog opens
      expect(find.text('Withdraw Request?'), findsOneWidget);
      await tester.tap(find.text('Withdraw Request'));
      await tester.pumpAndSettle();

      expect(withdrawn, isTrue);
    });

    testWidgets('5. Renders rejection note when cancellation is rejected', (tester) async {
      configureViewport(tester);

      final rejectedRequest = CancellationRequestModel(
        requestId: 'req_rej_01',
        bookingId: 'bk_01',
        eventId: 'evt_01',
        customerId: 'cust_01',
        vendorId: 'vnd_01',
        cancellationStatus: 'cancellation_rejected',
        refundStatus: 'refund_rejected',
        reason: 'Client requested late cancellation',
        decisionReason: 'Contractual cutoff exceeded; preparations completed by vendor.',
        calculation: const CancellationCalculationModel(
          policyVersion: 'POL-CAN-2026-V1',
          windowTier: 'last_minute',
          grossPaidPaise: 5000000,
          deductionBps: 5000,
          deductionPaise: 2500000,
          refundEstimatePaise: 2500000,
          isCustomReviewRequired: false,
          rationale: 'Last minute',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerCancellationStatusModal(
              request: rejectedRequest,
              apiService: MockCancellationApiService(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Cancellation Request Rejected'), findsOneWidget);
      expect(find.text('Contractual cutoff exceeded; preparations completed by vendor.'), findsOneWidget);
    });

    testWidgets('6. Displays simulated refund notice when refund execution confirmed', (tester) async {
      configureViewport(tester);

      final simulatedRequest = CancellationRequestModel(
        requestId: 'req_sim_01',
        bookingId: 'bk_01',
        eventId: 'evt_01',
        customerId: 'cust_01',
        vendorId: 'vnd_01',
        cancellationStatus: 'cancellation_completed',
        refundStatus: 'refund_confirmed',
        reason: 'Lockdown',
        calculation: const CancellationCalculationModel(
          policyVersion: 'POL-CAN-2026-V1',
          windowTier: 'standard_pre_event',
          grossPaidPaise: 5000000,
          deductionBps: 500,
          deductionPaise: 250000,
          refundEstimatePaise: 4750000,
          approvedRefundPaise: 4750000,
          isCustomReviewRequired: false,
          rationale: 'Standard Pre-Event',
        ),
        refundExecution: const RefundExecutionModel(
          executedBy: 'admin_01',
          amountPaise: 4750000,
          mode: 'sandbox_simulated',
          providerRefundId: 'rfnd_sim_123',
          isSimulated: true,
          disclaimer: 'SIMULATED REFUND',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CustomerCancellationStatusModal(
              request: simulatedRequest,
              apiService: MockCancellationApiService(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Cancellation Completed (Refund Executed)'), findsOneWidget);
      expect(find.textContaining('Refund execution was recorded in sandbox test-double mode'), findsOneWidget);
    });
  });

  group('Customer Bookings Screen Cancellation Integration Tests', () {
    testWidgets('7. Active booking displays Request Cancellation button and opens dialog', (tester) async {
      configureViewport(tester);

      final stream = Stream.value([sampleBooking]);

      await tester.pumpWidget(
        MaterialApp(
          home: CustomerBookingsScreen(
            bookingStream: stream,
            testCustomerId: 'cust_alice_101',
            cancellationApiService: MockCancellationApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cancel_booking_btn_bk_cancellation_test')), findsOneWidget);

      await tester.tap(find.byKey(const Key('cancel_booking_btn_bk_cancellation_test')));
      await tester.pumpAndSettle();

      expect(find.byType(CustomerCancellationRequestDialog), findsOneWidget);
    });

    testWidgets('8. Booking with active cancellation displays badge and status button', (tester) async {
      configureViewport(tester);

      final requestedBooking = sampleBooking.copyWith(
        cancellationStatus: 'cancellation_requested',
        cancellationRequestId: 'req_modal_01',
      );

      final stream = Stream.value([requestedBooking]);

      await tester.pumpWidget(
        MaterialApp(
          home: CustomerBookingsScreen(
            bookingStream: stream,
            testCustomerId: 'cust_alice_101',
            cancellationApiService: MockCancellationApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('CANCELLATION REQUESTED'), findsOneWidget);
      expect(find.byKey(const Key('view_cancellation_btn_bk_cancellation_test')), findsOneWidget);
    });
  });

  group('Admin Cancellation Queue View Tests', () {
    testWidgets('9. Admin queue renders requests with settlement conflict warning and amounts', (tester) async {
      configureViewport(tester);

      final conflictRequest = CancellationRequestModel(
        requestId: 'req_conflict_55',
        bookingId: 'bk_cater_55',
        eventId: 'evt_wedding_55',
        customerId: 'cust_priya_55',
        vendorId: 'vnd_gourmet_55',
        cancellationStatus: 'cancellation_requested',
        refundStatus: 'refund_pending_review',
        reason: 'Wedding cancelled due to emergency',
        hasSettlementConflict: true,
        settlementConflictDetails: 'Allocation has active approved vendor settlement set_01.',
        calculation: const CancellationCalculationModel(
          policyVersion: 'POL-CAN-2026-V1',
          windowTier: 'standard_pre_event',
          grossPaidPaise: 8000000,
          deductionBps: 500,
          deductionPaise: 400000,
          refundEstimatePaise: 7600000,
          isCustomReviewRequired: false,
          rationale: 'Standard Pre-Event',
        ),
      );

      final mockApi = MockCancellationApiService(
        onFetchAdminQueue: ({status, limit}) async => [conflictRequest],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdminCancellationQueueView(apiService: mockApi),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Request #REQ_CONF'), findsOneWidget);
      expect(find.text('Allocation has active approved vendor settlement set_01.'), findsOneWidget);
      expect(find.text('₹80,000.00'), findsOneWidget);
      expect(find.text('- ₹4,000.00'), findsOneWidget);
      expect(find.text('₹76,000.00'), findsOneWidget);
      expect(find.byKey(const Key('admin_review_btn_req_conflict_55')), findsOneWidget);
    });

    testWidgets('10. Admin review dialog approves cancellation with decision reason and refund paise', (tester) async {
      configureViewport(tester);
      bool approved = false;

      final pendingReq = CancellationRequestModel(
        requestId: 'req_approve_99',
        bookingId: 'bk_decor_99',
        eventId: 'evt_99',
        customerId: 'cust_99',
        vendorId: 'vnd_99',
        cancellationStatus: 'cancellation_requested',
        refundStatus: 'refund_pending_review',
        reason: 'Event venue unavailable',
        calculation: const CancellationCalculationModel(
          policyVersion: 'POL-CAN-2026-V1',
          windowTier: 'standard_pre_event',
          grossPaidPaise: 6000000,
          deductionBps: 500,
          deductionPaise: 300000,
          refundEstimatePaise: 5700000,
          isCustomReviewRequired: false,
          rationale: 'Standard Pre-Event',
        ),
      );

      final mockApi = MockCancellationApiService(
        onFetchAdminQueue: ({status, limit}) async => [pendingReq],
        onApprove: ({
          required requestId,
          required decisionReason,
          adminInternalNotes,
          required refundDecision,
          approvedRefundPaise,
        }) async {
          approved = true;
          expect(requestId, 'req_approve_99');
          expect(decisionReason, 'Approved under standard pre-event policy');
          expect(refundDecision, 'approve_refund');
          expect(approvedRefundPaise, 5700000);
          return pendingReq;
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdminCancellationQueueView(apiService: mockApi),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Open review dialog
      await tester.tap(find.byKey(const Key('admin_review_btn_req_approve_99')));
      await tester.pumpAndSettle();

      expect(find.text('Administrative Cancellation Review'), findsOneWidget);

      // Enter decision reason
      await tester.enterText(
        find.byKey(const Key('admin_decision_reason_input')),
        'Approved under standard pre-event policy',
      );
      await tester.pump();

      // Submit approval
      await tester.tap(find.byKey(const Key('confirm_approve_cancellation_btn')));
      await tester.pumpAndSettle();

      expect(approved, isTrue);
    });
  });
}
