import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:eventology_app/features/user/procurement/screens/event_procurement_screen.dart';
import 'package:eventology_app/features/user/procurement/widgets/payment_milestone_timeline_widget.dart';
import 'package:eventology_app/features/user/procurement/widgets/rfq_category_badge.dart';
import 'package:eventology_app/features/user/procurement/widgets/rfq_package_card.dart';
import 'package:eventology_app/features/user/procurement/widgets/rfq_status_chip.dart';
import 'package:eventology_app/models/rfq_model.dart';
import 'package:eventology_app/services/rfq_api_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final sampleAudioPackage = RfqPackageModel(
    id: 'pkg_audio_01',
    workflowId: 'wf_conf_2026',
    rfqBatchId: 'batch_conf_99',
    category: 'Audio',
    title: 'Audio Package: Main Hall PA System',
    status: 'quoted',
    lineItems: const [
      RfqLineItemModel(
        name: 'Line Array Speaker Cabinets',
        quantity: 8,
        unit: 'cabinets',
        estimatedRatePaise: 500000,
        specifications: 'd&b audiotechnik V-Series',
      ),
      RfqLineItemModel(
        name: 'Digital Mixing Console',
        quantity: 1,
        unit: 'console',
        estimatedRatePaise: 1500000,
        specifications: 'Yamaha CL5 72-channel',
      ),
    ],
    matchedVendorIds: const ['vnd_sound_01', 'vnd_sound_02'],
    assignedVendorId: 'vnd_sound_01',
    quotedAmountPaise: 5200000, // ₹52,000
    counterBidAmountPaise: 5500000, // ₹55,000 counter-bid
    notes: 'Includes dedicated audio technician on-site for rehearsal and show.',
    deliveryDeadlineIso: '2026-11-15T08:00:00.000Z',
  );

  final sampleLightingPackage = RfqPackageModel(
    id: 'pkg_lighting_01',
    workflowId: 'wf_conf_2026',
    rfqBatchId: 'batch_conf_99',
    category: 'Lighting',
    title: 'Lighting Package: Stage Wash & Moving Heads',
    status: 'accepted',
    lineItems: const [
      RfqLineItemModel(
        name: 'Moving Head Spot Fixtures',
        quantity: 12,
        unit: 'fixtures',
        estimatedRatePaise: 300000,
      ),
    ],
    matchedVendorIds: const ['vnd_lights_01'],
    assignedVendorId: 'vnd_lights_01',
    quotedAmountPaise: 3600000, // ₹36,000
    paymentMilestoneId: 'pay-milestone-pkg_lighting_01-1793265000',
    deliveryDeadlineIso: '2026-11-15T09:00:00.000Z',
  );

  final sampleVideoPackage = RfqPackageModel(
    id: 'pkg_video_01',
    workflowId: 'wf_conf_2026',
    rfqBatchId: 'batch_conf_99',
    category: 'Video',
    title: 'Video Package: 4K LED Screen Wall',
    status: 'dispatched',
    lineItems: const [
      RfqLineItemModel(
        name: 'P2.6 LED Video Wall Panels',
        quantity: 40,
        unit: 'panels',
        estimatedRatePaise: 250000,
      ),
    ],
    matchedVendorIds: const ['vnd_video_01', 'vnd_video_02'],
    deliveryDeadlineIso: '2026-11-15T07:00:00.000Z',
  );

  group('Milestone 47: RfqPackageModel & LineItem Unit Invariants', () {
    test('1. RfqLineItemModel calculates paise to INR and total accurately', () {
      const item = RfqLineItemModel(
        name: 'Subwoofer Cabinets',
        quantity: 4,
        unit: 'units',
        estimatedRatePaise: 750000, // ₹7,500
      );

      expect(item.estimatedRateInr, 7500.0);
      expect(item.estimatedTotalPaise, 3000000); // ₹30,000
      expect(item.estimatedTotalInr, 30000.0);
    });

    test('2. RfqPackageModel handles serialization, deserialization and status helpers', () {
      final map = sampleAudioPackage.toMap();
      final roundtrip = RfqPackageModel.fromMap(map);

      expect(roundtrip.id, 'pkg_audio_01');
      expect(roundtrip.category, 'Audio');
      expect(roundtrip.isQuoted, isTrue);
      expect(roundtrip.canAcceptOrDecline, isTrue);
      expect(roundtrip.isTerminal, isFalse);
      expect(roundtrip.quotedAmountInr, 52000.0);
      expect(roundtrip.counterBidAmountInr, 55000.0);
      expect(roundtrip.estimatedTotalPaise, 5500000); // 8*500k + 1*1.5M = 5.5M paise

      final acceptedPkg = sampleLightingPackage;
      expect(acceptedPkg.isAccepted, isTrue);
      expect(acceptedPkg.isTerminal, isTrue);
      expect(acceptedPkg.canAcceptOrDecline, isFalse);
    });

    test('3. RfqBatchModel calculates aggregate financial metrics', () {
      final batch = RfqBatchModel(
        id: 'batch_conf_99',
        workflowId: 'wf_conf_2026',
        eventName: 'Annual Corporate Summit 2026',
        status: 'dispatched',
        totalPackages: 3,
        totalEstimatedCostPaise: 19100000,
        totalApprovedCostPaise: 3600000,
        isFullyAccepted: false,
        packages: [sampleAudioPackage, sampleLightingPackage, sampleVideoPackage],
      );

      expect(batch.totalEstimatedCostInr, 191000.0);
      expect(batch.totalApprovedCostInr, 36000.0);
      expect(batch.acceptedPackagesCount, 1);
      expect(batch.quotedPackagesCount, 1);
      expect(batch.pendingPackagesCount, 2);
    });
  });

  group('Milestone 47: RfqApiService HTTP Integration', () {
    test('4. getPackagesByWorkflow returns parsed package list', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/rfq/wf_conf_2026/packages');
        return http.Response(
          jsonEncode({
            'success': true,
            'workflowId': 'wf_conf_2026',
            'packages': [
              sampleAudioPackage.toMap(),
              sampleLightingPackage.toMap(),
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(
        client: mockClient,
        baseUrl: 'http://127.0.0.1:3000/api/rfq',
        tokenProvider: () async => 'test-token',
      );

      final packages = await service.getPackagesByWorkflow('wf_conf_2026');
      expect(packages.length, 2);
      expect(packages[0].title, contains('PA System'));
      expect(packages[1].category, 'Lighting');
    });

    test('5. acceptQuotation returns paymentMilestoneId and updated package', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/rfq/package/pkg_audio_01/accept');
        return http.Response(
          jsonEncode({
            'success': true,
            'paymentMilestoneId': 'pay-milestone-pkg_audio_01-998877',
            'package': sampleAudioPackage
                .copyWith(
                  status: 'accepted',
                  paymentMilestoneId: 'pay-milestone-pkg_audio_01-998877',
                )
                .toMap(),
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(
        client: mockClient,
        baseUrl: 'http://127.0.0.1:3000/api/rfq',
      );

      final result = await service.acceptQuotation('pkg_audio_01');
      expect(result.success, isTrue);
      expect(result.paymentMilestoneId, 'pay-milestone-pkg_audio_01-998877');
      expect(result.package?.status, 'accepted');
    });

    test('6. declineQuotation transmits reason payload and updates status', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/rfq/package/pkg_audio_01/decline');
        final body = jsonDecode(request.body);
        expect(body['declineReason'], 'Budget exceeded for sound');

        return http.Response(
          jsonEncode({
            'success': true,
            'package': sampleAudioPackage
                .copyWith(
                  status: 'declined',
                  declineReason: 'Budget exceeded for sound',
                )
                .toMap(),
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(
        client: mockClient,
        baseUrl: 'http://127.0.0.1:3000/api/rfq',
      );

      final declinedPkg = await service.declineQuotation(
        'pkg_audio_01',
        declineReason: 'Budget exceeded for sound',
      );

      expect(declinedPkg.status, 'declined');
      expect(declinedPkg.declineReason, 'Budget exceeded for sound');
    });
  });

  group('Milestone 47: Category Badges & Status Chips UI', () {
    testWidgets('7. RfqCategoryBadge renders distinct category icons and labels', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                RfqCategoryBadge(category: 'Audio'),
                RfqCategoryBadge(category: 'Lighting'),
                RfqCategoryBadge(category: 'Video'),
                RfqCategoryBadge(category: 'Rigging'),
                RfqCategoryBadge(category: 'Power'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Audio'), findsOneWidget);
      expect(find.text('Lighting'), findsOneWidget);
      expect(find.text('Video'), findsOneWidget);
      expect(find.text('Rigging'), findsOneWidget);
      expect(find.text('Power'), findsOneWidget);
    });

    testWidgets('8. RfqStatusChip displays color-coded badges for all statuses', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                RfqStatusChip(status: 'quoted'),
                RfqStatusChip(status: 'accepted'),
                RfqStatusChip(status: 'dispatched'),
                RfqStatusChip(status: 'declined'),
              ],
            ),
          ),
        ),
      );

      expect(find.text('QUOTED'), findsOneWidget);
      expect(find.text('ACCEPTED'), findsOneWidget);
      expect(find.text('DISPATCHED'), findsOneWidget);
      expect(find.text('DECLINED'), findsOneWidget);
    });
  });

  group('Milestone 47: PaymentMilestoneTimelineWidget UI & Escrow Invariants', () {
    testWidgets('9. Displays empty placeholder notice when no packages are accepted yet', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: PaymentMilestoneTimelineWidget(
              packages: [],
              isBatchFullyAccepted: false,
              totalEstimatedCostPaise: 5000000,
              totalApprovedCostPaise: 0,
            ),
          ),
        ),
      );

      expect(find.text('ESCROW MILESTONES'), findsOneWidget);
      expect(find.text('No Escrow Milestones Created Yet'), findsOneWidget);
      expect(find.text('₹50000'), findsOneWidget); // Total estimated
      expect(find.text('₹0'), findsOneWidget); // Approved escrow
    });

    testWidgets('10. Displays accepted milestone cards with ID, amount, and escrow readiness status', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PaymentMilestoneTimelineWidget(
              packages: [sampleLightingPackage],
              isBatchFullyAccepted: true,
              totalEstimatedCostPaise: 3600000,
              totalApprovedCostPaise: 3600000,
            ),
          ),
        ),
      );

      expect(find.text('ESCROW READY'), findsOneWidget);
      expect(find.text('Lighting Package: Stage Wash & Moving Heads'), findsOneWidget);
      expect(find.text('pay-milestone-pkg_lighting_01-1793265000'), findsOneWidget);
      expect(find.text('₹36000'), findsWidgets);
    });
  });

  group('Milestone 47: RfqPackageCard Interactions & Quotation Workflow', () {
    testWidgets('11. Renders package card with counter-bid callout and responds to Accept action', (tester) async {
      bool acceptTapped = false;
      RfqPackageModel? acceptedPkg;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RfqPackageCard(
              package: sampleAudioPackage,
              onAccept: (pkg) {
                acceptTapped = true;
                acceptedPkg = pkg;
              },
            ),
          ),
        ),
      );

      expect(find.text('Audio Package: Main Hall PA System'), findsOneWidget);
      expect(find.text('Vendor Counter-Bid: ₹55000'), findsOneWidget);
      expect(find.text('QUOTED AMOUNT'), findsOneWidget);
      expect(find.text('₹52000'), findsOneWidget);
      expect(find.text('Accept Quotation'), findsOneWidget);
      expect(find.text('Decline'), findsOneWidget);

      await tester.tap(find.text('Accept Quotation'));
      await tester.pumpAndSettle();

      expect(acceptTapped, isTrue);
      expect(acceptedPkg?.id, 'pkg_audio_01');
    });

    testWidgets('12. Expands line items breakdown on tap', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: RfqPackageCard(package: sampleAudioPackage),
            ),
          ),
        ),
      );

      expect(find.text('Line Array Speaker Cabinets'), findsNothing);

      await tester.tap(find.text('View Equipment Items'));
      await tester.pumpAndSettle();

      expect(find.text('Line Array Speaker Cabinets'), findsOneWidget);
      expect(find.text('8 cabinets'), findsOneWidget);
      expect(find.text('Yamaha CL5 72-channel'), findsOneWidget);
    });
  });

  group('Milestone 47: EventProcurementScreen Complete Integration', () {
    testWidgets('13. Loads packages from API and displays metrics summary', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'packages': [
              sampleAudioPackage.toMap(),
              sampleLightingPackage.toMap(),
              sampleVideoPackage.toMap(),
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: EventProcurementScreen(
            workflowId: 'wf_conf_2026',
            eventName: 'Tech Global Summit 2026',
            apiService: service,
          ),
        ),
      );

      // Loading state
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.pumpAndSettle();

      expect(find.text('PROCUREMENT PIPELINE'), findsOneWidget);
      expect(find.text('Tech Global Summit 2026'), findsOneWidget);
      expect(find.text('TOTAL ESTIMATE'), findsOneWidget);
      expect(find.text('APPROVED ESCROW'), findsWidgets);
      expect(find.text('1 of 3 packages accepted'), findsOneWidget);
      expect(find.text('RFQ PACKAGES (3)'), findsOneWidget);
    });

    testWidgets('14. Filters packages by category chip', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'packages': [
              sampleAudioPackage.toMap(),
              sampleLightingPackage.toMap(),
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: EventProcurementScreen(
            workflowId: 'wf_conf_2026',
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: find.byType(RfqPackageCard),
          matching: find.text('Audio Package: Main Hall PA System'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(RfqPackageCard),
          matching: find.text('Lighting Package: Stage Wash & Moving Heads'),
        ),
        findsOneWidget,
      );

      // Tap 'Lighting' filter chip
      await tester.tap(find.widgetWithText(FilterChip, 'Lighting'));
      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: find.byType(RfqPackageCard),
          matching: find.text('Lighting Package: Stage Wash & Moving Heads'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byType(RfqPackageCard),
          matching: find.text('Audio Package: Main Hall PA System'),
        ),
        findsNothing,
      );
    });

    testWidgets('15. Accepting quotation triggers confirmation dialog and links escrow milestone', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/packages')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'packages': [sampleAudioPackage.toMap()],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        } else if (request.url.path.contains('/accept')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'paymentMilestoneId': 'pay-milestone-pkg_audio_01-test',
              'package': sampleAudioPackage
                  .copyWith(
                    status: 'accepted',
                    paymentMilestoneId: 'pay-milestone-pkg_audio_01-test',
                  )
                  .toMap(),
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not found', 404);
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: EventProcurementScreen(
            workflowId: 'wf_conf_2026',
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Accept Quotation'), findsOneWidget);
      await tester.tap(find.text('Accept Quotation'));
      await tester.pumpAndSettle();

      // Confirmation dialog appears
      expect(find.text('Accept Quotation & Link Escrow'), findsOneWidget);
      expect(find.text('Confirm Acceptance'), findsOneWidget);

      await tester.tap(find.text('Confirm Acceptance'));
      await tester.pumpAndSettle();

      // SnackBar with milestone info appears
      expect(find.textContaining('Quotation accepted! Escrow milestone: pay-milestone-pkg_audio_01-test'), findsOneWidget);
      // Status updated to accepted
      expect(find.text('Quotation Approved & Linked to Escrow'), findsOneWidget);
    });

    testWidgets('16. Declining quotation displays reason dialog and updates package to declined', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/packages')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'packages': [sampleAudioPackage.toMap()],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        } else if (request.url.path.contains('/decline')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'package': sampleAudioPackage
                  .copyWith(
                    status: 'declined',
                    declineReason: 'Rate outside client budget',
                  )
                  .toMap(),
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not found', 404);
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: EventProcurementScreen(
            workflowId: 'wf_conf_2026',
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Decline'), findsOneWidget);
      await tester.tap(find.text('Decline'));
      await tester.pumpAndSettle();

      // Decline dialog appears
      expect(find.text('Decline Quotation'), findsWidgets);
      await tester.enterText(find.byType(TextField), 'Rate outside client budget');
      await tester.tap(find.widgetWithText(ElevatedButton, 'Decline Quotation'));
      await tester.pumpAndSettle();

      expect(find.text('Quotation Declined'), findsOneWidget);
      expect(find.text('Reason: Rate outside client budget'), findsOneWidget);
    });

    testWidgets('17. Error view renders retry button on API failure', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response('Internal Server Error', 500);
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: EventProcurementScreen(
            workflowId: 'wf_conf_2026',
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Failed to Load Procurement Pipeline'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);
    });
  });
}
