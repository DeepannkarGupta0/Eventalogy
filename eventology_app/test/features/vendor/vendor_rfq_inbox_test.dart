import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:eventology_app/features/vendor/rfq/vendor_rfq_inbox_view.dart';
import 'package:eventology_app/features/vendor/rfq/widgets/vendor_quotation_submission_dialog.dart';
import 'package:eventology_app/features/vendor/rfq/widgets/vendor_rfq_card.dart';
import 'package:eventology_app/models/rfq_model.dart';
import 'package:eventology_app/services/rfq_api_service.dart';

void main() {
  const testVendorId = 'vnd_audio_pro';
  const testVendorName = 'SoundCraft Audio Pro';

  final sampleLineItems = [
    const RfqLineItemModel(
      name: 'Line Array Speaker Cabinets',
      quantity: 4,
      unit: 'units',
      estimatedRatePaise: 4000000, // ₹40,000 each -> ₹160,000 total
      specifications: 'Active dual 10-inch with flying hardware',
    ),
    const RfqLineItemModel(
      name: 'Dual 18" Subwoofers',
      quantity: 2,
      unit: 'units',
      estimatedRatePaise: 2500000, // ₹25,000 each -> ₹50,000 total
      specifications: 'Ground stack passive subs',
    ),
  ];

  final sampleDispatchedPackage = RfqPackageModel(
    id: 'pkg-audio-001',
    workflowId: 'wf-demo-summit',
    rfqBatchId: 'batch-001',
    category: 'Audio',
    title: 'Audio Equipment Package — Annual Tech Summit 2026',
    eventName: 'Annual Tech Summit 2026',
    venueName: 'Grand Hyatt Convention Center',
    guestCount: 500,
    status: 'dispatched',
    lineItems: sampleLineItems,
    matchedVendorIds: [testVendorId],
    deliveryDeadlineIso: '2026-12-15T08:00:00Z',
    dispatchedAtIso: '2026-11-01T10:00:00Z',
  );

  final sampleQuotedPackage = RfqPackageModel(
    id: 'pkg-lighting-002',
    workflowId: 'wf-demo-summit',
    rfqBatchId: 'batch-001',
    category: 'Lighting',
    title: 'Lighting Equipment Package — Annual Tech Summit 2026',
    eventName: 'Annual Tech Summit 2026',
    venueName: 'Grand Hyatt Convention Center',
    status: 'quoted',
    lineItems: [
      const RfqLineItemModel(
        name: 'Moving Head Spot 350W',
        quantity: 8,
        unit: 'units',
        estimatedRatePaise: 1500000,
      ),
    ],
    matchedVendorIds: [testVendorId],
    assignedVendorId: testVendorId,
    quotedAmountPaise: 11500000, // ₹115,000
    counterBidAmountPaise: 12500000, // ₹125,000
    quoteValidityDays: 14,
    deliveryCommitment: 'On-site 4 hours before soundcheck',
    notes: 'Includes DMX console and 1 dedicated LD',
    quotedAtIso: '2026-11-02T12:00:00Z',
  );

  final sampleAcceptedPackage = RfqPackageModel(
    id: 'pkg-video-003',
    workflowId: 'wf-demo-summit',
    rfqBatchId: 'batch-001',
    category: 'Video',
    title: 'Video Wall Package — Annual Tech Summit 2026',
    eventName: 'Annual Tech Summit 2026',
    venueName: 'Grand Hyatt Convention Center',
    status: 'accepted',
    lineItems: [
      const RfqLineItemModel(
        name: 'P2.6 LED Video Wall (16x9 ft)',
        quantity: 1,
        unit: 'setup',
        estimatedRatePaise: 35000000,
      ),
    ],
    matchedVendorIds: [testVendorId],
    assignedVendorId: testVendorId,
    quotedAmountPaise: 34000000, // ₹340,000
    paymentMilestoneId: 'pay-milestone-video-pkg-003-9982',
    acceptedAtIso: '2026-11-03T14:30:00Z',
  );

  group('Milestone 48: RfqItemPriceModel & Model Invariants', () {
    test('1. RfqItemPriceModel calculates paise to INR and serializes properly', () {
      const itemPrice = RfqItemPriceModel(
        itemName: 'Moving Head Wash',
        quotedRatePaise: 1850000, // ₹18,500
      );

      expect(itemPrice.quotedRateInr, 18500.0);
      final map = itemPrice.toMap();
      expect(map['itemName'], 'Moving Head Wash');
      expect(map['quotedRatePaise'], 1850000);

      final fromMap = RfqItemPriceModel.fromMap(map);
      expect(fromMap.itemName, 'Moving Head Wash');
      expect(fromMap.quotedRatePaise, 1850000);
      expect(fromMap.quotedRateInr, 18500.0);
    });

    test('2. RfqPackageModel parses itemPrices, quoteValidityDays, and deliveryCommitment', () {
      final map = {
        'id': 'pkg-audio-test',
        'workflowId': 'wf-1',
        'rfqBatchId': 'batch-1',
        'category': 'Audio',
        'title': 'Audio Setup',
        'eventName': 'Corporate Gala',
        'venueName': 'Taj Lands End',
        'status': 'quoted',
        'lineItems': [
          {
            'name': 'Line Array',
            'quantity': 2,
            'unit': 'sets',
            'estimatedRatePaise': 5000000,
          }
        ],
        'quotedAmountPaise': 9500000,
        'counterBidAmountPaise': 10500000,
        'itemPrices': [
          {'itemName': 'Line Array', 'quotedRatePaise': 4750000}
        ],
        'quoteValidityDays': 14,
        'deliveryCommitment': 'Guaranteed 4 hrs prior',
      };

      final pkg = RfqPackageModel.fromMap(map);
      expect(pkg.id, 'pkg-audio-test');
      expect(pkg.eventName, 'Corporate Gala');
      expect(pkg.venueName, 'Taj Lands End');
      expect(pkg.quotedAmountInr, 95000.0);
      expect(pkg.counterBidAmountInr, 105000.0);
      expect(pkg.quoteValidityDays, 14);
      expect(pkg.deliveryCommitment, 'Guaranteed 4 hrs prior');
      expect(pkg.itemPrices, isNotNull);
      expect(pkg.itemPrices!.length, 1);
      expect(pkg.itemPrices![0].quotedRateInr, 47500.0);
      expect(pkg.isQuoted, isTrue);
      expect(pkg.isAcknowledged, isFalse);
    });
  });

  group('Milestone 48: RfqApiService Vendor Integration', () {
    test('3. getPackagesForVendor returns parsed package inbox', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'GET');
        expect(
          request.url.path,
          '/api/rfq/vendor/$testVendorId/packages',
        );

        return http.Response(
          jsonEncode({
            'success': true,
            'vendorId': testVendorId,
            'packages': [
              sampleDispatchedPackage.toMap(),
              sampleQuotedPackage.toMap(),
              sampleAcceptedPackage.toMap(),
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/rfq',
        tokenProvider: () async => 'mock-jwt-token',
      );

      final packages = await service.getPackagesForVendor(testVendorId);
      expect(packages.length, 3);
      expect(packages[0].id, 'pkg-audio-001');
      expect(packages[0].category, 'Audio');
      expect(packages[1].isQuoted, isTrue);
      expect(packages[2].isAccepted, isTrue);
    });

    test('4. acknowledgeRfq calls backend and returns updated package', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/rfq/package/pkg-audio-001/acknowledge');

        final payload = jsonDecode(request.body);
        expect(payload['vendorId'], testVendorId);

        return http.Response(
          jsonEncode({
            'success': true,
            'package': sampleDispatchedPackage
                .copyWith(
                  status: 'acknowledged',
                  assignedVendorId: testVendorId,
                  acknowledgedAtIso: '2026-11-01T11:00:00Z',
                )
                .toMap(),
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/rfq',
      );

      final result =
          await service.acknowledgeRfq('pkg-audio-001', testVendorId);
      expect(result.status, 'acknowledged');
      expect(result.assignedVendorId, testVendorId);
    });

    test('5. submitQuotation transmits itemPrices, validity, notes, and commitments', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'POST');
        expect(request.url.path, '/api/rfq/package/pkg-audio-001/quote');

        final payload = jsonDecode(request.body);
        expect(payload['vendorId'], testVendorId);
        expect(payload['quotedAmountPaise'], 21000000);
        expect(payload['counterBidAmountPaise'], 22500000);
        expect(payload['quoteValidityDays'], 14);
        expect(payload['deliveryCommitment'], 'Delivered 4h before show');
        expect(payload['notes'], 'Includes sound engineer');
        expect(payload['itemPrices'], isList);
        expect((payload['itemPrices'] as List).length, 2);

        return http.Response(
          jsonEncode({
            'success': true,
            'package': sampleDispatchedPackage
                .copyWith(
                  status: 'quoted',
                  assignedVendorId: testVendorId,
                  quotedAmountPaise: 21000000,
                  counterBidAmountPaise: 22500000,
                  quoteValidityDays: 14,
                  deliveryCommitment: 'Delivered 4h before show',
                  notes: 'Includes sound engineer',
                )
                .toMap(),
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/rfq',
      );

      final result = await service.submitQuotation(
        'pkg-audio-001',
        vendorId: testVendorId,
        quotedAmountPaise: 21000000,
        counterBidAmountPaise: 22500000,
        itemPrices: [
          const RfqItemPriceModel(
            itemName: 'Line Array Speaker Cabinets',
            quotedRatePaise: 4000000,
          ),
          const RfqItemPriceModel(
            itemName: 'Dual 18" Subwoofers',
            quotedRatePaise: 2500000,
          ),
        ],
        quoteValidityDays: 14,
        deliveryCommitment: 'Delivered 4h before show',
        notes: 'Includes sound engineer',
      );

      expect(result.status, 'quoted');
      expect(result.quotedAmountInr, 210000.0);
      expect(result.counterBidAmountInr, 225000.0);
      expect(result.quoteValidityDays, 14);
    });
  });

  group('Milestone 48: VendorRfqCard Component Tests', () {
    testWidgets('6. VendorRfqCard renders dispatched state with Acknowledge and Submit Quote',
        (tester) async {
      bool ackTapped = false;
      bool quoteTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VendorRfqCard(
              package: sampleDispatchedPackage,
              onAcknowledge: (p) => ackTapped = true,
              onQuote: (p) => quoteTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Audio Equipment Package — Annual Tech Summit 2026'),
          findsOneWidget);
      expect(find.text('DISPATCHED'), findsOneWidget);
      expect(find.text('Acknowledge'), findsOneWidget);
      expect(find.text('Submit Quotation'), findsOneWidget);

      await tester.tap(find.text('Acknowledge'));
      await tester.pump();
      expect(ackTapped, isTrue);

      await tester.tap(find.text('Submit Quotation'));
      await tester.pump();
      expect(quoteTapped, isTrue);
    });

    testWidgets('7. VendorRfqCard renders quoted state with quote amount and Update Quotation',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VendorRfqCard(
              package: sampleQuotedPackage,
            ),
          ),
        ),
      );

      expect(find.text('QUOTED'), findsOneWidget);
      expect(find.text('YOUR QUOTE'), findsOneWidget);
      expect(find.text('₹115000'), findsOneWidget);
      expect(find.text('Update Quotation'), findsOneWidget);
      expect(find.text('On-site 4 hours before soundcheck'), findsOneWidget);
    });

    testWidgets('8. VendorRfqCard renders awarded state with escrow milestone and banner',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VendorRfqCard(
              package: sampleAcceptedPackage,
            ),
          ),
        ),
      );

      expect(find.text('ACCEPTED'), findsOneWidget);
      expect(find.text('AWARDED TO YOU • ESCROW LINKED'), findsOneWidget);
      expect(
        find.text(
            'Escrow Milestone: pay-milestone-video-pkg-003-9982'),
        findsOneWidget,
      );
      // No quote submission buttons for terminal awarded packages
      expect(find.text('Submit Quotation'), findsNothing);
      expect(find.text('Acknowledge'), findsNothing);
    });

    testWidgets('9. VendorRfqCard expands line items on tap', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VendorRfqCard(
              package: sampleDispatchedPackage,
            ),
          ),
        ),
      );

      expect(find.text('2 Equipment Requirements'), findsOneWidget);
      expect(find.text('Active dual 10-inch with flying hardware'), findsNothing);

      await tester.tap(find.text('2 Equipment Requirements'));
      await tester.pumpAndSettle();

      expect(
        find.text('Active dual 10-inch with flying hardware'),
        findsOneWidget,
      );
      expect(find.text('Ground stack passive subs'), findsOneWidget);
    });
  });

  group('Milestone 48: VendorQuotationSubmissionDialog Tests', () {
    testWidgets('10. Renders form with line item inputs and auto-calculates total',
        (tester) async {
      int? submittedTotalPaise;
      int? submittedCounterPaise;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => VendorQuotationSubmissionDialog(
                      package: sampleDispatchedPackage,
                      vendorId: testVendorId,
                      onSubmit: ({
                        required int quotedAmountPaise,
                        int? counterBidAmountPaise,
                        List<RfqItemPriceModel>? itemPrices,
                        String? notes,
                        int? quoteValidityDays,
                        String? deliveryCommitment,
                      }) async {
                        submittedTotalPaise = quotedAmountPaise;
                        submittedCounterPaise = counterBidAmountPaise;
                      },
                    ),
                  );
                },
                child: const Text('Open Dialog'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Dialog'));
      await tester.pumpAndSettle();

      expect(find.text('SUBMIT QUOTATION'), findsOneWidget);
      expect(find.text('EQUIPMENT LINE ITEMS (RATES)'), findsOneWidget);
      expect(find.text('TOTAL QUOTED AMOUNT (₹)'), findsOneWidget);

      // Verify line items are listed
      expect(find.text('Line Array Speaker Cabinets'), findsOneWidget);
      expect(find.text('Dual 18" Subwoofers'), findsOneWidget);

      // Submit quotation
      await tester.tap(find.text('Submit Quotation'));
      await tester.pumpAndSettle();

      expect(submittedTotalPaise, isNotNull);
      expect(submittedTotalPaise, greaterThan(0));
    });
  });

  group('Milestone 48: VendorRfqInboxView Complete Integration Tests', () {
    testWidgets('11. Loads inbox packages and displays summary metrics bar',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'packages': [
              sampleDispatchedPackage.toMap(),
              sampleQuotedPackage.toMap(),
              sampleAcceptedPackage.toMap(),
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorRfqInboxView(
            vendorId: testVendorId,
            vendorName: testVendorName,
            apiService: service,
          ),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      expect(find.text('PRODUCTION RFQ INBOX'), findsOneWidget);
      expect(find.text('SoundCraft Audio Pro'), findsOneWidget);
      expect(find.text('OPEN RFQS'), findsOneWidget);
      expect(find.text('QUOTED'), findsNWidgets(2)); // metric tile + status chip
      expect(find.text('AWARDED'), findsOneWidget);
      expect(find.text('ACTIVE PIPELINE VALUE'), findsOneWidget);
      expect(find.text('RFQ PACKAGES (3)'), findsOneWidget);
    });

    testWidgets('12. Category filter chip filters packages dynamically',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'packages': [
              sampleDispatchedPackage.toMap(), // Audio
              sampleQuotedPackage.toMap(), // Lighting
              sampleAcceptedPackage.toMap(), // Video
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorRfqInboxView(
            vendorId: testVendorId,
            vendorName: testVendorName,
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('RFQ PACKAGES (3)'), findsOneWidget);

      // Tap 'Audio' filter chip
      await tester.tap(find.widgetWithText(FilterChip, 'Audio'));
      await tester.pumpAndSettle();

      expect(find.text('RFQ PACKAGES (1)'), findsOneWidget);
      expect(find.text('Audio Equipment Package — Annual Tech Summit 2026'),
          findsOneWidget);
      expect(find.text('Lighting Equipment Package — Annual Tech Summit 2026'),
          findsNothing);
    });

    testWidgets('13. Status filter choice chip filters by lifecycle state',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'packages': [
              sampleDispatchedPackage.toMap(),
              sampleQuotedPackage.toMap(),
              sampleAcceptedPackage.toMap(),
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorRfqInboxView(
            vendorId: testVendorId,
            vendorName: testVendorName,
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap 'Awarded' status filter
      await tester.tap(find.text('Awarded'));
      await tester.pumpAndSettle();

      expect(find.text('RFQ PACKAGES (1)'), findsOneWidget);
      expect(find.text('Video Wall Package — Annual Tech Summit 2026'),
          findsOneWidget);
      expect(find.text('AWARDED TO YOU • ESCROW LINKED'), findsOneWidget);
    });

    testWidgets('14. Acknowledging an RFQ updates card in-place and shows SnackBar',
        (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/packages')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'packages': [sampleDispatchedPackage.toMap()],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        } else if (request.url.path.contains('/acknowledge')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'package': sampleDispatchedPackage
                  .copyWith(
                    status: 'acknowledged',
                    assignedVendorId: testVendorId,
                  )
                  .toMap(),
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 404);
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorRfqInboxView(
            vendorId: testVendorId,
            vendorName: testVendorName,
            apiService: service,
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('DISPATCHED'), findsOneWidget);
      expect(find.text('Acknowledge'), findsOneWidget);

      await tester.tap(find.text('Acknowledge'));
      await tester.pumpAndSettle();

      expect(find.text('ACKNOWLEDGED'), findsOneWidget);
      expect(find.textContaining('Acknowledged receipt of'), findsOneWidget);
    });

    testWidgets('15. Error view renders retry button on API failure',
        (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response('Internal Server Error', 500);
      });

      final service = RfqApiService(client: mockClient);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorRfqInboxView(
            vendorId: testVendorId,
            vendorName: testVendorName,
            apiService: service,
          ),
        ),
      );

      await tester.pump();
      await tester.pumpAndSettle();

      expect(find.text('Failed to Load RFQ Inbox'), findsOneWidget);
      expect(find.text('Try Again'), findsOneWidget);
    });
  });
}
