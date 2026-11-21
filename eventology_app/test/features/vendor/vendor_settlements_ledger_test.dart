import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/features/vendor/settlements/vendor_settlements_ledger_view.dart';
import 'package:eventology_app/models/settlements_model.dart';
import 'package:eventology_app/services/settlement_api_service.dart';

class MockSettlementApiService extends SettlementApiService {
  final Future<VendorSettlementHistoryResponseModel> Function({String? status, int? limit})? onFetchHistory;

  MockSettlementApiService({this.onFetchHistory});

  @override
  Future<VendorSettlementHistoryResponseModel> fetchVendorSettlementHistory({
    String? status,
    int? limit,
  }) async {
    if (onFetchHistory != null) {
      return await onFetchHistory!(status: status, limit: limit);
    }
    throw UnimplementedError();
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

  final sampleSummary = VendorSettlementSummaryModel(
    totalGrossPaise: 350000,
    pendingApprovalGrossPaise: 100000,
    approvedReservedNetPaise: 180000,
    reconciledPaidNetPaise: 45000,
    rejectedGrossPaise: 30000,
    totalPlatformFeePaise: 25000,
    totalWithholdingTaxPaise: 0,
    totalDeductionsPaise: 25000,
    netDisbursablePaise: 180000,
    disbursementConfigured: false,
    systemLimitationNotice:
        'Automated payouts are currently unconfigured. Reconciled entries reflect verified internal accounting records and are not proof of external bank transfers.',
  );

  final sampleSettlements = [
    VendorSettlementItemModel(
      settlementId: 'stl_pending_01',
      proposalReference: 'PROP_PEND_01',
      eventId: 'evt_wedding_01',
      eventTitle: 'Royal Mumbai Wedding',
      bookingId: 'bk_catering_01',
      vendorId: 'vnd_royal_catering',
      allocationId: 'alloc_catering_01',
      serviceId: 'srv_banquet_dinner',
      currency: 'INR',
      grossAmountPaise: 100000,
      deductionsPaise: 10000,
      netAmountPaise: 90000,
      status: 'pending_approval',
      calculationBreakdown: const VendorSettlementCalculationBreakdownModel(
        grossAmountPaise: 100000,
        platformFeeBps: 1000,
        platformFeePaise: 10000,
        withholdingTaxBps: 0,
        withholdingTaxPaise: 0,
        netAmountPaise: 90000,
        currency: 'INR',
        isAvailable: true,
      ),
      proposedAt: DateTime(2026, 10, 20, 10, 30),
      disbursementStatus: 'payout_not_configured',
    ),
    VendorSettlementItemModel(
      settlementId: 'stl_approved_02',
      proposalReference: 'PROP_APPR_02',
      eventId: 'evt_wedding_01',
      eventTitle: 'Royal Mumbai Wedding',
      bookingId: 'bk_catering_01',
      vendorId: 'vnd_royal_catering',
      allocationId: 'alloc_catering_01',
      serviceId: 'srv_banquet_dinner',
      currency: 'INR',
      grossAmountPaise: 200000,
      deductionsPaise: 20000,
      netAmountPaise: 180000,
      status: 'approved',
      calculationBreakdown: const VendorSettlementCalculationBreakdownModel(
        grossAmountPaise: 200000,
        platformFeeBps: 1000,
        platformFeePaise: 20000,
        withholdingTaxBps: 0,
        withholdingTaxPaise: 0,
        netAmountPaise: 180000,
        currency: 'INR',
        isAvailable: true,
      ),
      proposedAt: DateTime(2026, 10, 21, 11, 0),
      approvedAt: DateTime(2026, 10, 21, 14, 30),
      disbursementStatus: 'payout_not_configured',
    ),
    VendorSettlementItemModel(
      settlementId: 'stl_paid_03',
      proposalReference: 'PROP_PAID_03',
      eventId: 'evt_wedding_01',
      eventTitle: 'Royal Mumbai Wedding',
      bookingId: 'bk_catering_01',
      vendorId: 'vnd_royal_catering',
      allocationId: 'alloc_catering_01',
      serviceId: 'srv_banquet_dinner',
      currency: 'INR',
      grossAmountPaise: 50000,
      deductionsPaise: 5000,
      netAmountPaise: 45000,
      status: 'paid',
      calculationBreakdown: const VendorSettlementCalculationBreakdownModel(
        grossAmountPaise: 50000,
        platformFeeBps: 1000,
        platformFeePaise: 5000,
        withholdingTaxBps: 0,
        withholdingTaxPaise: 0,
        netAmountPaise: 45000,
        currency: 'INR',
        isAvailable: true,
      ),
      proposedAt: DateTime(2026, 10, 22, 9, 0),
      approvedAt: DateTime(2026, 10, 22, 12, 0),
      reconciledAt: DateTime(2026, 10, 22, 16, 0),
      reconciliationType: 'manual_ledger',
      payoutReference: 'UTR_MANUAL_REC_9988',
      reconciliationEvidence: 'Bank branch physical voucher deposit receipt',
      disbursementStatus: 'executed',
    ),
    VendorSettlementItemModel(
      settlementId: 'stl_rejected_04',
      proposalReference: 'PROP_REJ_04',
      eventId: 'evt_wedding_01',
      eventTitle: 'Royal Mumbai Wedding',
      bookingId: 'bk_catering_01',
      vendorId: 'vnd_royal_catering',
      allocationId: 'alloc_catering_01',
      serviceId: 'srv_banquet_dinner',
      currency: 'INR',
      grossAmountPaise: 30000,
      deductionsPaise: 0,
      netAmountPaise: 30000,
      status: 'rejected',
      rejectionReason: 'Tax invoice line item discrepancy required correction',
      proposedAt: DateTime(2026, 10, 23, 15, 0),
      rejectedAt: DateTime(2026, 10, 23, 17, 30),
      disbursementStatus: 'payout_not_configured',
    ),
  ];

  Widget buildTestWidget({required SettlementApiService apiService}) {
    return MaterialApp(
      home: VendorSettlementsLedgerView(apiService: apiService),
    );
  }

  group('VendorSettlementsLedgerView - UI & Functional Invariant Tests', () {
    testWidgets('1. Displays loading indicator while fetching vendor settlement history', (tester) async {
      configureViewport(tester);

      final completer = Completer<VendorSettlementHistoryResponseModel>();
      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) => completer.future,
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pump();

      expect(find.text('Loading settlement ledger...'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      completer.complete(
        VendorSettlementHistoryResponseModel(
          vendorId: 'vnd_royal_catering',
          settlements: [],
          summary: sampleSummary,
        ),
      );
      await tester.pumpAndSettle();
    });

    testWidgets('2. Renders error state and allows retry on network failure', (tester) async {
      configureViewport(tester);

      bool retried = false;
      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          if (!retried) {
            throw Exception('Connection to settlement service timed out.');
          }
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: sampleSettlements,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      expect(find.text('Failed to load settlement statement'), findsOneWidget);
      expect(find.text('Connection to settlement service timed out.'), findsOneWidget);
      expect(find.byKey(const Key('vendor_settlements_retry_button')), findsOneWidget);

      retried = true;
      await tester.tap(find.byKey(const Key('vendor_settlements_retry_button')));
      await tester.pumpAndSettle();

      expect(find.text('Settlement Statement Ledger'), findsOneWidget);
      expect(find.text('Failed to load settlement statement'), findsNothing);
    });

    testWidgets('3. Renders empty state when vendor has no settlement proposals', (tester) async {
      configureViewport(tester);

      final emptySummary = VendorSettlementSummaryModel(
        totalGrossPaise: 0,
        pendingApprovalGrossPaise: 0,
        approvedReservedNetPaise: 0,
        reconciledPaidNetPaise: 0,
        rejectedGrossPaise: 0,
        totalPlatformFeePaise: 0,
        totalWithholdingTaxPaise: 0,
        totalDeductionsPaise: 0,
        netDisbursablePaise: 0,
        disbursementConfigured: false,
        systemLimitationNotice: sampleSummary.systemLimitationNotice,
      );

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_empty',
            settlements: [],
            summary: emptySummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      expect(find.text('No Settlement Statements Found'), findsOneWidget);
      expect(find.textContaining('Settlement proposals created for completed services will appear in this ledger.'), findsOneWidget);
    });

    testWidgets('4. Renders statement balances by status, clearly distinguishing pending, approved, paid, and rejected amounts', (tester) async {
      configureViewport(tester);

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: sampleSettlements,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      // Heading
      expect(find.text('STATEMENT BALANCES BY STATUS'), findsOneWidget);

      // Pending Review Card
      expect(find.text('Pending Review'), findsOneWidget);
      expect(find.text(sampleSummary.formattedPendingApproval), findsWidgets); // ₹1,000.00
      expect(find.text('Under admin review'), findsOneWidget);

      // Approved Reserved Card
      expect(find.text('Approved Reserved'), findsOneWidget);
      expect(find.text(sampleSummary.formattedApprovedReserved), findsWidgets); // ₹1,800.00
      expect(find.text('Internal ledger reserved'), findsOneWidget);

      // Reconciled Paid Card
      expect(find.text('Reconciled Paid'), findsOneWidget);
      expect(find.text(sampleSummary.formattedReconciledPaid), findsWidgets); // ₹450.00
      expect(find.text('Manual ledger recorded'), findsOneWidget);

      // Adjusted / Rejected Card
      expect(find.text('Adjusted / Rejected'), findsOneWidget);
      expect(find.text(sampleSummary.formattedRejected), findsWidgets); // ₹300.00
      expect(find.text('Requires resubmission'), findsOneWidget);
    });

    testWidgets('5. Renders disbursement gateway boundary disclaimer (automated payouts unconfigured / manual reconciliation not a bank transfer proof)', (tester) async {
      configureViewport(tester);

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: sampleSettlements,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      expect(find.text('Disbursement Gateway Boundary'), findsOneWidget);
      expect(find.textContaining('Automated payouts are currently unconfigured'), findsOneWidget);
      expect(find.textContaining('not proof of external bank transfers'), findsOneWidget);
    });

    testWidgets('6. Renders commercial deduction transparency breakdown', (tester) async {
      configureViewport(tester);

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: sampleSettlements,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      expect(find.text('Commercial Deduction Transparency'), findsOneWidget);
      expect(find.text('Total Proposed Gross'), findsOneWidget);
      expect(find.text(sampleSummary.formattedTotalGross), findsOneWidget); // ₹3,500.00
      expect(find.text('Platform Service Fee'), findsOneWidget);
      expect(find.text('- ${sampleSummary.formattedTotalPlatformFee}'), findsNWidgets(2)); // Platform Fee & Total Deductions
      expect(find.text('Withholding Tax (TDS)'), findsOneWidget);
      expect(find.text('Net Disbursable Balance'), findsOneWidget);
      expect(find.text(sampleSummary.formattedNetDisbursable), findsWidgets);
    });

    testWidgets('7. Filters settlements when filter chip is tapped', (tester) async {
      configureViewport(tester);

      String? requestedStatus;
      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          requestedStatus = status;
          final filtered = status == null
              ? sampleSettlements
              : sampleSettlements.where((s) => s.status == status).toList();
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: filtered,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      expect(find.text('PROP_PEND_01'), findsOneWidget);
      expect(find.text('PROP_APPR_02'), findsOneWidget);
      expect(find.text('PROP_PAID_03'), findsOneWidget);
      expect(find.text('PROP_REJ_04'), findsOneWidget);

      // Tap 'Approved' chip
      await tester.tap(find.text('Approved'));
      await tester.pumpAndSettle();

      expect(requestedStatus, 'approved');
      expect(find.text('PROP_APPR_02'), findsOneWidget);
      expect(find.text('PROP_PEND_01'), findsNothing);
    });

    testWidgets('8. Opens statement detail modal showing line-by-line financial breakdown and rejection reason for rejected settlement', (tester) async {
      configureViewport(tester);

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: sampleSettlements,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      // Scroll to rejected settlement card and tap
      await tester.ensureVisible(find.text('PROP_REJ_04'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('PROP_REJ_04'));
      await tester.pumpAndSettle();

      // Modal is displayed
      expect(find.text('Statement #PROP_REJ_04'), findsOneWidget);
      expect(find.text('Proposal Rejected / Adjustment Required'), findsOneWidget);
      expect(find.text('Tax invoice line item discrepancy required correction'), findsOneWidget);
      expect(find.text('FINANCIAL STATEMENT BREAKDOWN'), findsOneWidget);
      expect(find.text('PROVENANCE & LEDGER IDENTIFIERS'), findsOneWidget);
    });

    testWidgets('9. Opens statement detail modal showing manual ledger reconciliation evidence when paid', (tester) async {
      configureViewport(tester);

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: sampleSettlements,
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      // Scroll to paid settlement card and tap
      await tester.ensureVisible(find.text('PROP_PAID_03'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('PROP_PAID_03'));
      await tester.pumpAndSettle();

      expect(find.text('Statement #PROP_PAID_03'), findsOneWidget);
      expect(find.text('Manual Ledger Reconciliation Recorded'), findsWidgets);
      expect(find.text('Accounting Reference: UTR_MANUAL_REC_9988'), findsOneWidget);
      expect(find.text('Evidence: Bank branch physical voucher deposit receipt'), findsOneWidget);
      expect(find.textContaining('This entry confirms internal ledger reconciliation. It does not represent an automated electronic bank transfer.'), findsOneWidget);
    });

    testWidgets('10. Handles legacy record with isAvailable: false safely without crashing', (tester) async {
      configureViewport(tester);

      final legacySettlement = VendorSettlementItemModel(
        settlementId: 'stl_legacy_99',
        proposalReference: 'PROP_LEGACY_99',
        eventId: 'evt_wedding_01',
        eventTitle: 'Royal Mumbai Wedding',
        bookingId: 'bk_catering_01',
        vendorId: 'vnd_royal_catering',
        allocationId: 'alloc_catering_01',
        currency: 'INR',
        grossAmountPaise: 80000,
        deductionsPaise: 0,
        netAmountPaise: 80000,
        status: 'pending_approval',
        calculationBreakdown: const VendorSettlementCalculationBreakdownModel(
          grossAmountPaise: 80000,
          platformFeeBps: 0,
          platformFeePaise: 0,
          withholdingTaxBps: 0,
          withholdingTaxPaise: 0,
          netAmountPaise: 80000,
          currency: 'INR',
          isAvailable: false,
        ),
      );

      final mockApi = MockSettlementApiService(
        onFetchHistory: ({status, limit}) async {
          return VendorSettlementHistoryResponseModel(
            vendorId: 'vnd_royal_catering',
            settlements: [legacySettlement],
            summary: sampleSummary,
          );
        },
      );

      await tester.pumpWidget(buildTestWidget(apiService: mockApi));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('PROP_LEGACY_99'));
      await tester.pumpAndSettle();
      expect(find.text('PROP_LEGACY_99'), findsOneWidget);

      await tester.tap(find.text('PROP_LEGACY_99'));
      await tester.pumpAndSettle();

      expect(find.text('Detailed calculation breakdown unavailable for this record.'), findsOneWidget);
      expect(find.text('Gross Amount'), findsOneWidget);
      expect(find.text('Net Statement Amount'), findsOneWidget);
    });
  });
}
