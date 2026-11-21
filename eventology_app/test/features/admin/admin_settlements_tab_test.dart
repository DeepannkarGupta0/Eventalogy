import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:eventology_app/features/admin/admin_settlements_tab.dart';
import 'package:eventology_app/models/settlements_model.dart';
import 'package:eventology_app/services/settlement_api_service.dart';

void main() {
  Widget buildTestWidget({
    SettlementApiService? apiService,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: AdminSettlementsTab(apiService: apiService),
      ),
    );
  }

  SettlementModel createSampleSettlement({
    String id = 'stl_test_001',
    String status = 'pending_approval',
    int grossPaise = 200000, // ₹2,000.00
    int platformFeePaise = 20000, // ₹200.00 (1000 bps)
    int withholdingTaxPaise = 1000, // ₹10.00 (50 bps)
    int deductionsPaise = 21000, // ₹210.00
    int netPaise = 179000, // ₹1,790.00
    String? disbursementStatus = 'payout_not_configured',
    String? disbursementBlockedReason = 'Payout provider unconfigured',
    String? rejectionReason,
    String? payoutReference,
    String? reconciliationEvidence,
  }) {
    return SettlementModel(
      settlementId: id,
      allocationId: 'alloc_venue_123',
      vendorId: 'vendor_decor_99',
      eventId: 'event_wedding_456',
      bookingId: 'booking_decor_789',
      paymentId: 'pay_cust_razorpay_999',
      proposalReference: 'PROP-2026-TEST-001',
      grossAmountPaise: grossPaise,
      deductionsPaise: deductionsPaise,
      netAmountPaise: netPaise,
      calculationInputs: SettlementCalculationInputsModel(
        grossAmountPaise: grossPaise,
        platformFeeBps: 1000,
        platformFeePaise: platformFeePaise,
        withholdingTaxBps: 50,
        withholdingTaxPaise: withholdingTaxPaise,
        netAmountPaise: netPaise,
        currency: 'INR',
        notes: 'STANDARD_FEE_POLICY_V1',
      ),
      status: status,
      disbursementStatus: disbursementStatus,
      disbursementBlockedReason: disbursementBlockedReason,
      proposedBy: 'admin_user_01',
      proposedAt: DateTime(2026, 10, 28, 10, 0, 0),
      rejectionReason: rejectionReason,
      payoutReference: payoutReference,
      reconciliationEvidence: reconciliationEvidence,
    );
  }

  group('SettlementApiService - HTTP Unit Tests', () {
    test('fetchSettlements parses settlements and converts INR paise', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/settlements');
        expect(request.url.queryParameters['status'], 'pending_approval');
        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': 'stl_api_1',
                'allocationId': 'alloc_1',
                'vendorId': 'vendor_1',
                'eventId': 'event_1',
                'paymentId': 'pay_1',
                'proposalReference': 'PROP-1',
                'grossAmountPaise': 500000,
                'deductionsPaise': 50000,
                'netAmountPaise': 450000,
                'calculationInputs': {
                  'grossAllocationPaise': 500000,
                  'confirmedPaymentPaise': 500000,
                  'remainingBalancePaise': 500000,
                  'platformFeeBps': 1000,
                  'platformFeePaise': 50000,
                  'withholdingTaxBps': 0,
                  'withholdingTaxPaise': 0,
                  'policyReference': 'TEST_POLICY',
                  'feePolicyApproved': true,
                },
                'status': 'pending_approval',
                'disbursementStatus': 'payout_not_configured',
                'disbursementBlockedReason': 'Payout provider unconfigured',
                'proposedBy': 'admin_1',
                'createdAt': '2026-10-28T10:00:00Z',
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      final list = await service.fetchSettlements(status: 'pending_approval');
      expect(list.length, 1);
      expect(list.first.settlementId, 'stl_api_1');
      expect(list.first.formattedGross, '₹5,000.00');
      expect(list.first.formattedNet, '₹4,500.00');
      expect(list.first.formattedPlatformFee, '₹500.00 (10.0%)');
    });

    test('reconcileSettlement handles manual reconciliation with evidence payload', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/settlements/stl_rec_1/reconcile');
        expect(request.method, 'POST');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['payoutReference'], 'UTR_SBI_99887766');
        expect(body['reconciliationEvidence'], 'Bank portal ledger confirmation ref #9988');

        return http.Response(
          jsonEncode({
            'success': true,
            'settlement': {
              'settlementId': 'stl_rec_1',
              'allocationId': 'alloc_1',
              'vendorId': 'vendor_1',
              'eventId': 'event_1',
              'paymentId': 'pay_1',
              'proposalReference': 'PROP-REC',
              'grossAmountPaise': 100000,
              'deductionsPaise': 10000,
              'netAmountPaise': 90000,
              'status': 'paid',
              'disbursementStatus': 'manual_reconciled',
              'payoutReference': 'UTR_SBI_99887766',
              'reconciliationEvidence': 'Bank portal ledger confirmation ref #9988',
              'reconciledBy': 'admin_auditor',
              'reconciledAt': '2026-10-28T10:30:00Z',
            }
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      final res = await service.reconcileSettlement(
        'stl_rec_1',
        payoutReference: 'UTR_SBI_99887766',
        reconciliationEvidence: 'Bank portal ledger confirmation ref #9988',
      );

      expect(res.status, 'paid');
      expect(res.payoutReference, 'UTR_SBI_99887766');
      expect(res.isPaid, isTrue);
    });

    test('handles HTTP 401/403 and server errors gracefully', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Admin role required for this action'}),
          403,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      expect(
        () => service.approveSettlement('stl_forbidden'),
        throwsA(predicate((e) => e.toString().contains('Admin role required'))),
      );
    });

    test('fetchEligibleAllocations queries endpoint and parses EligibleAllocationModel', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/settlements/eligible-allocations');
        return http.Response(
          jsonEncode({
            'success': true,
            'allocations': [
              {
                'allocationId': 'alloc_el_1',
                'eventId': 'ev_el_1',
                'eventTitle': 'Grand Gala',
                'vendorId': 'vnd_royal',
                'vendorName': 'Royal Catering',
                'category': 'catering',
                'bookingId': 'bk_el_1',
                'paymentId': 'pay_el_1',
                'contractedAmountPaise': 5000000,
                'confirmedPaidPaise': 5000000,
                'totalSettledPaise': 0,
                'totalPendingPaise': 0,
                'remainingEligiblePaise': 5000000,
                'status': 'confirmed',
                'settlementEligibility': 'eligible',
                'fulfillmentStatus': 'completed',
                'paymentStatus': 'paid',
                'isEligibleForSettlement': true,
                'completionApprovedAt': '2026-10-28T10:00:00Z',
              },
              {
                'allocationId': 'alloc_blk_2',
                'eventId': 'ev_el_1',
                'vendorId': 'vnd_decor',
                'contractedAmountPaise': 3000000,
                'remainingEligiblePaise': 3000000,
                'status': 'confirmed',
                'settlementEligibility': 'pending_completion',
                'fulfillmentStatus': 'in_progress',
                'paymentStatus': 'paid',
                'isEligibleForSettlement': false,
                'blockedReason': 'Service delivery completion review pending administrative approval',
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      final list = await service.fetchEligibleAllocations();
      expect(list.length, 2);
      expect(list[0].allocationId, 'alloc_el_1');
      expect(list[0].isEligible, isTrue);
      expect(list[0].remainingEligibleINR, 50000.0);
      expect(list[1].allocationId, 'alloc_blk_2');
      expect(list[1].isEligible, isFalse);
      expect(list[1].blockedReason, contains('Service delivery completion review pending'));
    });

    test('proposeSettlement sends POST with explicit commercial fee bps and financial parameters', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/settlements/propose');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['allocationId'], 'alloc_el_1');
        expect(body['paymentId'], 'pay_el_1');
        expect(body['platformFeeBps'], 1000);
        expect(body['withholdingTaxBps'], 100);
        expect(body['proposedAmountPaise'], 5000000);
        expect(body['notes'], 'STANDARD_POLICY_10_PERCENT');

        return http.Response(
          jsonEncode({
            'success': true,
            'settlement': {
              'settlementId': 'stl_new_1',
              'allocationId': 'alloc_el_1',
              'vendorId': 'vnd_royal',
              'eventId': 'ev_el_1',
              'paymentId': 'pay_el_1',
              'proposalReference': 'PROP-2026-NEW-01',
              'grossAmountPaise': 5000000,
              'deductionsPaise': 550000,
              'netAmountPaise': 4450000,
              'calculationInputs': {
                'grossAllocationPaise': 5000000,
                'confirmedPaymentPaise': 5000000,
                'remainingBalancePaise': 5000000,
                'platformFeeBps': 1000,
                'platformFeePaise': 500000,
                'withholdingTaxBps': 100,
                'withholdingTaxPaise': 50000,
                'netAmountPaise': 4450000,
                'policyReference': 'STANDARD_POLICY_10_PERCENT',
                'feePolicyApproved': true,
              },
              'status': 'pending_approval',
              'disbursementStatus': 'payout_not_configured',
            }
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      final res = await service.proposeSettlement(
        paymentId: 'pay_el_1',
        allocationId: 'alloc_el_1',
        platformFeeBps: 1000,
        withholdingTaxBps: 100,
        proposedAmountPaise: 5000000,
        notes: 'STANDARD_POLICY_10_PERCENT',
      );

      expect(res.settlementId, 'stl_new_1');
      expect(res.grossAmountINR, 50000.0);
      expect(res.deductionsINR, 5500.0);
      expect(res.netAmountINR, 44500.0);
      expect(res.isPendingApproval, isTrue);
    });
  });

  group('AdminSettlementsTab - Widget & Financial Clarity Tests', () {
    testWidgets('1. Loading state and empty state rendering', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': true, 'settlements': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      // First frame shows loading
      expect(find.byKey(const Key('settlements_loading')), findsOneWidget);

      await tester.pumpAndSettle();
      // Settled shows empty state
      expect(find.byKey(const Key('settlements_empty')), findsOneWidget);
      expect(find.text('No settlements found.'), findsOneWidget);
    });

    testWidgets('2. Error banner and retry functionality', (tester) async {
      int callCount = 0;
      final mockClient = MockClient((request) async {
        callCount++;
        if (callCount == 1) {
          return http.Response(
            jsonEncode({'error': 'Internal server error'}),
            500,
            headers: {'content-type': 'application/json'},
          );
        } else {
          return http.Response(
            jsonEncode({
              'success': true,
              'settlements': [
                {
                  'settlementId': 'stl_recovered_1',
                  'allocationId': 'alloc_rec',
                  'vendorId': 'vendor_rec',
                  'eventId': 'event_rec',
                  'paymentId': 'pay_rec',
                  'proposalReference': 'PROP-REC-01',
                  'grossAmountPaise': 300000,
                  'deductionsPaise': 30000,
                  'netAmountPaise': 270000,
                  'status': 'pending_approval',
                }
              ]
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Error message should be rendered
      expect(find.byKey(const Key('settlements_error')), findsOneWidget);
      expect(find.textContaining('Internal server error'), findsOneWidget);

      // Tap Retry button
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      // Now loaded item should appear
      expect(find.text('ID: stl_recovered_1'), findsOneWidget);
      expect(find.text('₹2,700.00'), findsOneWidget);
    });

    testWidgets('3. INR / Paise formatting and blocked payout display', (tester) async {
      final sample = createSampleSettlement(
        id: 'stl_format_01',
        grossPaise: 200000, // ₹2,000.00
        platformFeePaise: 20000, // ₹200.00
        deductionsPaise: 21000, // ₹210.00
        netPaise: 179000, // ₹1,790.00
      );

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'bookingId': sample.bookingId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'calculationInputs': {
                  'grossAllocationPaise': sample.grossAmountPaise,
                  'confirmedPaymentPaise': sample.grossAmountPaise,
                  'remainingBalancePaise': sample.grossAmountPaise,
                  'platformFeeBps': 1000,
                  'platformFeePaise': 20000,
                  'withholdingTaxBps': 50,
                  'withholdingTaxPaise': 1000,
                  'policyReference': 'STANDARD_POLICY',
                  'feePolicyApproved': true,
                },
                'status': sample.status,
                'disbursementStatus': sample.disbursementStatus,
                'disbursementBlockedReason': sample.disbursementBlockedReason,
                'proposedBy': sample.proposedBy,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Check net formatted amount
      expect(find.text('₹1,790.00'), findsOneWidget);
      // Check gross and fee in summary line
      expect(
        find.textContaining('Gross Contracted: ₹2,000.00'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Platform Fee: ₹200.00'),
        findsOneWidget,
      );
      expect(
        find.textContaining('Deductions: ₹210.00'),
        findsOneWidget,
      );

      // Verify disbursement notice disclaimer banner is visible
      expect(
        find.textContaining('DISBURSEMENT NOTICE: Automated real-money transfers are strictly disabled'),
        findsOneWidget,
      );

      // Verify blocked state indicator
      expect(
        find.textContaining('Disbursement Blocked: Payout provider unconfigured'),
        findsOneWidget,
      );
    });

    testWidgets('4. Filter by status and search field', (tester) async {
      final item1 = createSampleSettlement(id: 'stl_pending_1', status: 'pending_approval');
      final item2 = createSampleSettlement(id: 'stl_approved_2', status: 'approved');

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': item1.settlementId,
                'allocationId': item1.allocationId,
                'vendorId': item1.vendorId,
                'eventId': item1.eventId,
                'paymentId': item1.paymentId,
                'proposalReference': item1.proposalReference,
                'grossAmountPaise': item1.grossAmountPaise,
                'deductionsPaise': item1.deductionsPaise,
                'netAmountPaise': item1.netAmountPaise,
                'status': item1.status,
              },
              {
                'settlementId': item2.settlementId,
                'allocationId': item2.allocationId,
                'vendorId': item2.vendorId,
                'eventId': item2.eventId,
                'paymentId': item2.paymentId,
                'proposalReference': item2.proposalReference,
                'grossAmountPaise': item2.grossAmountPaise,
                'deductionsPaise': item2.deductionsPaise,
                'netAmountPaise': item2.netAmountPaise,
                'status': item2.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      expect(find.text('ID: stl_pending_1'), findsOneWidget);
      expect(find.text('ID: stl_approved_2'), findsOneWidget);

      // Enter search query
      await tester.enterText(
        find.byKey(const Key('settlements_search_field')),
        'stl_pending',
      );
      await tester.pumpAndSettle();

      expect(find.text('ID: stl_pending_1'), findsOneWidget);
      expect(find.text('ID: stl_approved_2'), findsNothing);
    });

    testWidgets('5. Detail dialog displays financial breakdown & entity provenance', (tester) async {
      final sample = createSampleSettlement(id: 'stl_detail_test');

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'bookingId': sample.bookingId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'calculationInputs': {
                  'grossAllocationPaise': sample.grossAmountPaise,
                  'confirmedPaymentPaise': sample.grossAmountPaise,
                  'remainingBalancePaise': sample.grossAmountPaise,
                  'platformFeeBps': 1000,
                  'platformFeePaise': 20000,
                  'withholdingTaxBps': 50,
                  'withholdingTaxPaise': 1000,
                  'policyReference': 'STANDARD_POLICY',
                  'feePolicyApproved': true,
                },
                'status': sample.status,
                'disbursementStatus': sample.disbursementStatus,
                'proposedBy': sample.proposedBy,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Tap Details & Audit
      await tester.tap(find.text('Details & Audit'));
      await tester.pumpAndSettle();

      expect(find.text('Settlement Detail: stl_detail_test'), findsOneWidget);
      expect(find.text('Gross Contracted Amount'), findsOneWidget);
      expect(find.text('Platform Fee BPS'), findsOneWidget);
      expect(find.text('1000 bps (10.0%)'), findsOneWidget);
      expect(find.text('Withholding Tax BPS'), findsOneWidget);
      expect(find.text('50 bps (0.5%)'), findsOneWidget);
      expect(find.text('Vendor ID'), findsOneWidget);
      expect(find.text(sample.vendorId), findsOneWidget);
      expect(find.text(sample.paymentId), findsOneWidget);

      // Check boundary disclaimer
      expect(
        find.textContaining('Policy Boundary: Real money disbursement is blocked'),
        findsOneWidget,
      );

      // Close dialog
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      expect(find.text('Settlement Detail: stl_detail_test'), findsNothing);
    });

    testWidgets('6. Settlement approval confirmation flow', (tester) async {
      final sample = createSampleSettlement(id: 'stl_approve_1', status: 'pending_approval');
      bool approveCalled = false;

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/approve')) {
          approveCalled = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'settlement': {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'status': 'approved',
                'disbursementStatus': 'payout_not_configured',
                'approvedBy': 'admin_test',
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'status': sample.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Tap Approve
      await tester.tap(find.byKey(const Key('approve_button_stl_approve_1')));
      await tester.pumpAndSettle();

      // Dialog opens
      expect(find.text('Confirm Settlement Approval'), findsOneWidget);
      expect(
        find.textContaining('Real money is NOT automatically transferred'),
        findsOneWidget,
      );

      // Confirm approval
      await tester.tap(find.byKey(const Key('confirm_approval_dialog_button')));
      await tester.pumpAndSettle();

      expect(approveCalled, isTrue);
      expect(find.textContaining('successfully approved'), findsOneWidget);
    });

    testWidgets('7. Rejection requires mandatory reason', (tester) async {
      final sample = createSampleSettlement(id: 'stl_reject_1', status: 'pending_approval');
      bool rejectCalled = false;

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/reject')) {
          rejectCalled = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'settlement': {
                'settlementId': sample.settlementId,
                'status': 'rejected',
                'rejectionReason': 'Disputed invoice amount',
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'status': sample.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Tap Reject
      await tester.tap(find.byKey(const Key('reject_button_stl_reject_1')));
      await tester.pumpAndSettle();

      expect(find.text('Reject Settlement Proposal'), findsOneWidget);

      // Tap Reject & Release without reason
      await tester.tap(find.byKey(const Key('confirm_reject_dialog_button')));
      await tester.pumpAndSettle();

      // Validation error shown, reject API not called
      expect(find.text('Rejection reason is required.'), findsOneWidget);
      expect(rejectCalled, isFalse);

      // Enter valid reason
      await tester.enterText(
        find.byKey(const Key('reject_reason_input')),
        'Disputed invoice amount - vendor overbilled hours',
      );
      await tester.tap(find.byKey(const Key('confirm_reject_dialog_button')));
      await tester.pumpAndSettle();

      expect(rejectCalled, isTrue);
      expect(find.textContaining('rejected and balance released'), findsOneWidget);
    });

    testWidgets('8. Manual reconciliation validation and disclaimer notices', (tester) async {
      final sample = createSampleSettlement(id: 'stl_reconcile_1', status: 'approved');
      bool reconcileCalled = false;

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/reconcile')) {
          reconcileCalled = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'settlement': {
                'settlementId': sample.settlementId,
                'status': 'paid',
                'disbursementStatus': 'manual_reconciled',
                'payoutReference': 'UTR_BANK_123456',
                'reconciliationEvidence': 'Verified in corporate netbanking portal statement',
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'status': sample.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Tap Manual Reconcile button on approved card
      await tester.tap(find.byKey(const Key('reconcile_button_stl_reconcile_1')));
      await tester.pumpAndSettle();

      // Verify disclaimer notice in reconciliation dialog
      expect(
        find.textContaining('This is an administrative manual reconciliation and does NOT constitute independent gateway verification'),
        findsOneWidget,
      );

      // Attempt submit empty
      await tester.tap(find.byKey(const Key('confirm_reconcile_dialog_button')));
      await tester.pumpAndSettle();

      // Both validations fail
      expect(find.text('Reference must be at least 6 characters.'), findsOneWidget);
      expect(find.text('Evidence must be substantive (at least 10 chars).'), findsOneWidget);
      expect(reconcileCalled, isFalse);

      // Enter valid fields
      await tester.enterText(
        find.byKey(const Key('reconcile_reference_input')),
        'UTR_BANK_123456',
      );
      await tester.enterText(
        find.byKey(const Key('reconcile_evidence_input')),
        'Verified in corporate netbanking portal statement',
      );

      await tester.tap(find.byKey(const Key('confirm_reconcile_dialog_button')));
      await tester.pumpAndSettle();

      expect(reconcileCalled, isTrue);
      expect(find.textContaining('reconciled to PAID'), findsOneWidget);
    });

    testWidgets('9. Stale-state error handling displays backend error feedback', (tester) async {
      final sample = createSampleSettlement(id: 'stl_stale_1', status: 'pending_approval');

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/approve')) {
          return http.Response(
            jsonEncode({'error': 'Cannot approve settlement: status is already cancelled.'}),
            400,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'status': sample.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Tap Approve
      await tester.tap(find.byKey(const Key('approve_button_stl_stale_1')));
      await tester.pumpAndSettle();

      // Confirm in dialog
      await tester.tap(find.byKey(const Key('confirm_approval_dialog_button')));
      await tester.pumpAndSettle();

      // SnackBar with backend error message must be shown
      expect(
        find.textContaining('Cannot approve settlement: status is already cancelled.'),
        findsOneWidget,
      );
    });

    testWidgets('10. Refresh button updates dashboard with latest server state', (tester) async {
      int fetchCount = 0;
      final samplePending = createSampleSettlement(id: 'stl_refresh_1', status: 'pending_approval');
      final sampleApproved = createSampleSettlement(id: 'stl_refresh_1', status: 'approved');

      final mockClient = MockClient((request) async {
        fetchCount++;
        final currentSample = fetchCount == 1 ? samplePending : sampleApproved;
        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': currentSample.settlementId,
                'allocationId': currentSample.allocationId,
                'vendorId': currentSample.vendorId,
                'eventId': currentSample.eventId,
                'paymentId': currentSample.paymentId,
                'proposalReference': currentSample.proposalReference,
                'grossAmountPaise': currentSample.grossAmountPaise,
                'deductionsPaise': currentSample.deductionsPaise,
                'netAmountPaise': currentSample.netAmountPaise,
                'status': currentSample.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      expect(find.text('PENDING APPROVAL'), findsOneWidget);
      expect(find.byKey(const Key('approve_button_stl_refresh_1')), findsOneWidget);

      // Tap Refresh button
      await tester.tap(find.byKey(const Key('settlements_refresh_button')));
      await tester.pumpAndSettle();

      // UI should now reflect server state (APPROVED)
      expect(find.text('APPROVED'), findsOneWidget);
      expect(find.byKey(const Key('reconcile_button_stl_refresh_1')), findsOneWidget);
      expect(find.byKey(const Key('approve_button_stl_refresh_1')), findsNothing);
    });

    testWidgets('11. Duplicate submission protection prevents double triggers', (tester) async {
      int approveCalls = 0;
      final sample = createSampleSettlement(id: 'stl_dup_1', status: 'pending_approval');

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/approve')) {
          approveCalls++;
          // simulate slight async latency
          await Future.delayed(const Duration(milliseconds: 100));
          return http.Response(
            jsonEncode({
              'success': true,
              'settlement': {
                'settlementId': sample.settlementId,
                'status': 'approved',
              }
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sample.settlementId,
                'allocationId': sample.allocationId,
                'vendorId': sample.vendorId,
                'eventId': sample.eventId,
                'paymentId': sample.paymentId,
                'proposalReference': sample.proposalReference,
                'grossAmountPaise': sample.grossAmountPaise,
                'deductionsPaise': sample.deductionsPaise,
                'netAmountPaise': sample.netAmountPaise,
                'status': sample.status,
              }
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Open approval dialog
      await tester.tap(find.byKey(const Key('approve_button_stl_dup_1')));
      await tester.pumpAndSettle();

      // Tap confirm approval
      await tester.tap(find.byKey(const Key('confirm_approval_dialog_button')));
      // Advance by 50ms (in-flight)
      await tester.pump(const Duration(milliseconds: 50));

      // Buttons on tab should have null onPressed or be unclickable while submitting
      expect(approveCalls, 1);

      // Finish async call
      await tester.pumpAndSettle();
      expect(approveCalls, 1);
    });

    testWidgets('12. View toggle switches to Eligibility Queue and displays eligible vs blocked allocations with reasons', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/eligible-allocations')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'allocations': [
                {
                  'allocationId': 'alloc_queue_el_1',
                  'eventId': 'ev_gala_01',
                  'eventTitle': 'Gala Dinner',
                  'vendorId': 'vnd_royal_catering',
                  'vendorName': 'Royal Catering',
                  'category': 'catering',
                  'bookingId': 'bk_gala_01',
                  'paymentId': 'pay_gala_01',
                  'contractedAmountPaise': 5000000,
                  'confirmedPaidPaise': 5000000,
                  'totalSettledPaise': 0,
                  'totalPendingPaise': 0,
                  'remainingEligiblePaise': 5000000,
                  'status': 'confirmed',
                  'settlementEligibility': 'eligible',
                  'fulfillmentStatus': 'completed',
                  'paymentStatus': 'paid',
                  'isEligibleForSettlement': true,
                  'completionApprovedAt': '2026-10-28T10:00:00Z',
                },
                {
                  'allocationId': 'alloc_queue_blk_2',
                  'eventId': 'ev_gala_01',
                  'eventTitle': 'Gala Dinner',
                  'vendorId': 'vnd_sound_lights',
                  'vendorName': 'Sound & Lights Co',
                  'category': 'sound',
                  'contractedAmountPaise': 2000000,
                  'confirmedPaidPaise': 0,
                  'totalSettledPaise': 0,
                  'totalPendingPaise': 0,
                  'remainingEligiblePaise': 2000000,
                  'status': 'confirmed',
                  'settlementEligibility': 'pending_completion',
                  'fulfillmentStatus': 'in_progress',
                  'paymentStatus': 'pending',
                  'isEligibleForSettlement': false,
                  'blockedReason': 'Service delivery completion review pending administrative approval; Customer payment not yet completed',
                }
              ]
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({'success': true, 'settlements': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Check view toggle button exists and switch to Eligibility Queue
      expect(find.byKey(const Key('tab_eligibility_queue')), findsOneWidget);
      await tester.tap(find.byKey(const Key('tab_eligibility_queue')));
      await tester.pumpAndSettle();

      // Verify disclaimer banner
      expect(find.textContaining('ELIGIBILITY QUEUE: Allocations require administrative service delivery completion approval'), findsOneWidget);

      // Verify eligible card
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_el_1')), findsOneWidget);
      expect(find.text('ELIGIBLE FOR REVIEW'), findsOneWidget);
      expect(find.byKey(const Key('propose_settlement_button_alloc_queue_el_1')), findsOneWidget);

      // Verify blocked card and reason
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_blk_2')), findsOneWidget);
      expect(find.text('BLOCKED'), findsOneWidget);
      expect(find.textContaining('Customer payment not yet completed'), findsOneWidget);
      expect(find.byKey(const Key('propose_settlement_button_alloc_queue_blk_2')), findsNothing);

      // Test Search in Eligibility Queue
      await tester.enterText(find.byKey(const Key('allocations_search_field')), 'Royal Catering');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_el_1')), findsOneWidget);
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_blk_2')), findsNothing);

      // Clear search
      await tester.enterText(find.byKey(const Key('allocations_search_field')), '');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_el_1')), findsOneWidget);
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_blk_2')), findsOneWidget);

      // Test Filter dropdown
      await tester.tap(find.byKey(const Key('allocations_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Eligible For Review').last);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_el_1')), findsOneWidget);
      expect(find.byKey(const Key('eligible_allocation_card_alloc_queue_blk_2')), findsNothing);
    });

    testWidgets('13. Propose settlement dialog enforces explicit fee policy selection, live net calculation, policy checkbox gating, and submits', (tester) async {
      tester.view.physicalSize = const Size(1200, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      bool proposeCalled = false;
      Map<String, dynamic>? submittedBody;

      final mockClient = MockClient((request) async {
        if (request.method == 'POST' && request.url.path == '/api/settlements/propose') {
          proposeCalled = true;
          submittedBody = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'success': true,
              'settlement': {
                'settlementId': 'stl_created_99',
                'allocationId': 'alloc_prop_test',
                'vendorId': 'vnd_royal',
                'eventId': 'ev_gala',
                'paymentId': 'pay_gala',
                'proposalReference': 'PROP-TEST-99',
                'grossAmountPaise': 5000000,
                'deductionsPaise': 250000,
                'netAmountPaise': 4750000,
                'status': 'pending_approval',
              }
            }),
            201,
            headers: {'content-type': 'application/json'},
          );
        }

        if (request.url.path.contains('/eligible-allocations')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'allocations': [
                {
                  'allocationId': 'alloc_prop_test',
                  'eventId': 'ev_gala',
                  'eventTitle': 'Grand Gala',
                  'vendorId': 'vnd_royal',
                  'vendorName': 'Royal Catering',
                  'category': 'catering',
                  'bookingId': 'bk_gala',
                  'paymentId': 'pay_gala',
                  'contractedAmountPaise': 5000000,
                  'confirmedPaidPaise': 5000000,
                  'totalSettledPaise': 0,
                  'totalPendingPaise': 0,
                  'remainingEligiblePaise': 5000000,
                  'status': 'confirmed',
                  'settlementEligibility': 'eligible',
                  'fulfillmentStatus': 'completed',
                  'paymentStatus': 'paid',
                  'isEligibleForSettlement': true,
                  'completionApprovedAt': '2026-10-28T10:00:00Z',
                }
              ]
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response(
          jsonEncode({'success': true, 'settlements': []}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Switch to Eligibility Queue
      await tester.tap(find.byKey(const Key('tab_eligibility_queue')));
      await tester.pumpAndSettle();

      // Tap Propose Settlement
      await tester.tap(find.byKey(const Key('propose_settlement_button_alloc_prop_test')));
      await tester.pumpAndSettle();

      // Dialog opens
      expect(find.text('Propose Settlement: alloc_prop_test'), findsOneWidget);
      expect(find.text('Vendor: Royal Catering'), findsOneWidget);

      // Verify default fee is 10% (1000 bps) and net is ₹45000.00 (gross ₹50000 - fee ₹5000)
      expect(find.text('₹45000.00'), findsOneWidget);

      // Switch fee dropdown to Early Partner Rate: 5% (500 bps)
      await tester.tap(find.byKey(const Key('propose_platform_fee_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Early Partner Rate: 5% (500 bps)').last);
      await tester.pumpAndSettle();

      // Live net calculation updates: ₹50,000 - ₹2,500 = ₹47500.00
      expect(find.text('₹47500.00'), findsOneWidget);

      // Verify submit button is disabled when policy checkbox is unchecked
      final submitFinder = find.byKey(const Key('confirm_propose_dialog_button'));
      final ElevatedButton submitBtn = tester.widget(submitFinder);
      expect(submitBtn.onPressed, isNull);

      // Check policy confirmation checkbox
      await tester.tap(find.byKey(const Key('confirm_policy_checkbox')));
      await tester.pumpAndSettle();

      // Submit button is now enabled
      final ElevatedButton enabledBtn = tester.widget(submitFinder);
      expect(enabledBtn.onPressed, isNotNull);

      // Tap Submit
      await tester.tap(submitFinder);
      await tester.pumpAndSettle();

      expect(proposeCalled, isTrue);
      expect(submittedBody!['allocationId'], 'alloc_prop_test');
      expect(submittedBody!['platformFeeBps'], 500);
      expect(submittedBody!['proposedAmountPaise'], 5000000);
      expect(submittedBody!['notes'], 'EARLY_PARTNER_FEE_5_PERCENT');

      // Success snackbar displayed
      expect(find.textContaining('Settlement proposal created successfully for allocation alloc_prop_test'), findsOneWidget);
    });

    testWidgets('14. Status badges render explicit non-bank labels (\'Approved — Payout Not Configured\' and \'Manual Ledger Reconciliation Recorded\')', (tester) async {
      tester.view.physicalSize = const Size(1200, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final sampleApproved = createSampleSettlement(
        id: 'stl_badge_approved_1',
        status: 'approved',
        disbursementStatus: 'payout_not_configured',
      );
      final samplePaid = SettlementModel(
        settlementId: 'stl_badge_paid_2',
        allocationId: 'alloc_venue_123',
        vendorId: 'vendor_decor_99',
        eventId: 'event_wedding_456',
        paymentId: 'pay_cust_razorpay_999',
        proposalReference: 'PROP-2026-PAID-01',
        grossAmountPaise: 200000,
        deductionsPaise: 20000,
        netAmountPaise: 180000,
        calculationInputs: SettlementCalculationInputsModel(
          grossAmountPaise: 200000,
          platformFeeBps: 1000,
          platformFeePaise: 20000,
          withholdingTaxBps: 0,
          withholdingTaxPaise: 0,
          netAmountPaise: 180000,
          currency: 'INR',
        ),
        status: 'paid',
        reconciliationType: 'manual_ledger',
        reconciliationEvidence: 'Bank passbook verified UTR 12345678',
        payoutReference: 'UTR_BANK_12345678',
        proposedBy: 'admin_user_01',
      );

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'settlements': [
              {
                'settlementId': sampleApproved.settlementId,
                'allocationId': sampleApproved.allocationId,
                'vendorId': sampleApproved.vendorId,
                'eventId': sampleApproved.eventId,
                'paymentId': sampleApproved.paymentId,
                'proposalReference': sampleApproved.proposalReference,
                'grossAmountPaise': sampleApproved.grossAmountPaise,
                'deductionsPaise': sampleApproved.deductionsPaise,
                'netAmountPaise': sampleApproved.netAmountPaise,
                'status': 'approved',
                'disbursementStatus': 'payout_not_configured',
                'disbursementBlockedReason': 'Payout provider unconfigured',
              },
              {
                'settlementId': samplePaid.settlementId,
                'allocationId': samplePaid.allocationId,
                'vendorId': samplePaid.vendorId,
                'eventId': samplePaid.eventId,
                'paymentId': samplePaid.paymentId,
                'proposalReference': samplePaid.proposalReference,
                'grossAmountPaise': samplePaid.grossAmountPaise,
                'deductionsPaise': samplePaid.deductionsPaise,
                'netAmountPaise': samplePaid.netAmountPaise,
                'status': 'paid',
                'reconciliationType': 'manual_ledger',
                'reconciliationEvidence': 'Bank passbook verified UTR 12345678',
                'payoutReference': 'UTR_BANK_12345678',
              },
            ]
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = SettlementApiService(
        client: mockClient,
        baseUrl: 'http://localhost:5001/api/settlements',
      );

      await tester.pumpWidget(buildTestWidget(apiService: service));
      await tester.pumpAndSettle();

      // Check exact display labels on model and in cards
      expect(sampleApproved.statusDisplayLabel, 'Approved — Payout Not Configured');
      expect(samplePaid.statusDisplayLabel, 'Manual Ledger Reconciliation Recorded');
      expect(find.text('APPROVED — PAYOUT NOT CONFIGURED'), findsOneWidget);
      expect(find.text('MANUAL LEDGER RECONCILIATION RECORDED'), findsOneWidget);
    });
  });
}
