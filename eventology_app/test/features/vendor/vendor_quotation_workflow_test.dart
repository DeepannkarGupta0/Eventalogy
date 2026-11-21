import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:eventology_app/models/enquiries_model.dart';
import 'package:eventology_app/models/quotations_model.dart';
import 'package:eventology_app/services/quotation_api_service.dart';
import 'package:eventology_app/features/vendor/enquiries/vendor_enquiries_view.dart';
import 'package:eventology_app/features/user/enquiries/screens/customer_enquiries_screen.dart';
import 'package:eventology_app/features/user/enquiries/widgets/customer_quotation_dialog.dart';

void main() {
  final sampleEnquiry = EnquiryModel(
    enquiryId: 'enq_test_101',
    eventId: 'evt_wedding_01',
    customerId: 'cust_priya_123',
    vendorId: 'vendor_photo_real_789',
    serviceId: 'srv_photography',
    message: 'Need full-day photography and drone coverage.',
    requirements: {
      'type': 'vendor',
      'vendorName': 'Apex Photography',
      'guestCount': 200,
    },
    requestedDate: Timestamp.fromDate(DateTime(2026, 12, 20)),
    status: 'pending',
    createdAt: Timestamp.fromDate(DateTime(2026, 10, 25, 10, 0)),
  );

  final sampleQuotedEnquiry = EnquiryModel(
    enquiryId: 'enq_quoted_202',
    eventId: 'evt_wedding_02',
    customerId: 'cust_priya_123',
    vendorId: 'vendor_photo_real_789',
    serviceId: 'srv_photography',
    message: 'Stage decor requirements.',
    requirements: {
      'type': 'vendor',
      'vendorName': 'Apex Photography',
      'guestCount': 150,
    },
    requestedDate: Timestamp.fromDate(DateTime(2026, 12, 22)),
    status: 'vendor_accepted',
    createdAt: Timestamp.fromDate(DateTime(2026, 10, 26, 11, 0)),
  );

  final sampleQuotationJson = {
    'quotationId': 'quot_abc_123',
    'enquiryId': 'enq_quoted_202',
    'eventId': 'evt_wedding_02',
    'customerId': 'cust_priya_123',
    'vendorId': 'vendor_photo_real_789',
    'serviceId': 'srv_photography',
    'currency': 'INR',
    'lineItems': [
      {
        'description': 'Full Day Photography',
        'quantity': 1,
        'unitPricePaise': 4500000,
        'totalPaise': 4500000,
      },
      {
        'description': 'Drone Operator',
        'quantity': 1,
        'unitPricePaise': 1000000,
        'totalPaise': 1000000,
      }
    ],
    'subtotalPaise': 5500000,
    'taxPaise': 400000,
    'totalAmountPaise': 5900000,
    'inclusions': ['Edited Photos', 'Teaser Reel'],
    'exclusions': ['Raw footage hard drive'],
    'notes': 'Advance confirmation required.',
    'validUntil': DateTime.now().add(const Duration(days: 7)).toIso8601String(),
    'status': 'submitted',
    'submittedBy': 'user_vendor_owner',
    'createdAt': DateTime.now().toIso8601String(),
    'updatedAt': DateTime.now().toIso8601String(),
  };

  Widget buildTestApp(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('QuotationApiService - HTTP Unit Tests', () {
    test('1. submitQuotation posts valid payload and parses response', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/quotations');
        expect(request.method, 'POST');
        final body = jsonDecode(request.body);
        expect(body['enquiryId'], 'enq_test_101');
        expect(body['lineItems'].length, 1);
        expect(body['taxPaise'], 50000);

        return http.Response(
          jsonEncode({
            'success': true,
            'quotation': sampleQuotationJson,
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      final result = await service.submitQuotation(
        enquiryId: 'enq_test_101',
        lineItems: [
          const QuotationLineItemModel(
            description: 'Item 1',
            quantity: 1,
            unitPricePaise: 500000,
            totalPaise: 500000,
          )
        ],
        taxPaise: 50000,
      );

      expect(result.quotationId, 'quot_abc_123');
      expect(result.totalAmountPaise, 5900000);
      expect(result.formattedTotal, '₹59,000.00');
    });

    test('2. fetchQuotationsForEnquiry returns list of quotations', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/quotations/enquiry/enq_quoted_202');
        return http.Response(
          jsonEncode({
            'success': true,
            'quotations': [sampleQuotationJson],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      final list = await service.fetchQuotationsForEnquiry('enq_quoted_202');
      expect(list.length, 1);
      expect(list.first.quotationId, 'quot_abc_123');
      expect(list.first.inclusions, contains('Edited Photos'));
    });

    test('3. acceptQuotation posts accept action and returns booking/allocation info', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/quotations/quot_abc_123/accept');
        expect(request.method, 'POST');
        return http.Response(
          jsonEncode({
            'success': true,
            'quotation': {
              ...sampleQuotationJson,
              'status': 'accepted',
              'bookingId': 'book_created_777',
              'allocationId': 'alloc_created_888',
            },
            'bookingId': 'book_created_777',
            'allocationId': 'alloc_created_888',
            'isExisting': false,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      final res = await service.acceptQuotation('quot_abc_123');
      expect(res['success'], isTrue);
      expect(res['bookingId'], 'book_created_777');
      expect(res['allocationId'], 'alloc_created_888');
      final quote = res['quotation'] as QuotationModel;
      expect(quote.status, 'accepted');
    });

    test('4. declineQuotation posts decline reason and returns updated quote', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, '/api/quotations/quot_abc_123/decline');
        final body = jsonDecode(request.body);
        expect(body['declineReason'], 'Price too high');
        return http.Response(
          jsonEncode({
            'success': true,
            'quotation': {
              ...sampleQuotationJson,
              'status': 'declined',
              'declineReason': 'Price too high',
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      final quote = await service.declineQuotation('quot_abc_123', 'Price too high');
      expect(quote.status, 'declined');
      expect(quote.declineReason, 'Price too high');
    });

    test('5. API error throws exception with parsed error message', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'error': 'Quotation has already expired.'}),
          400,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      expect(
        () => service.acceptQuotation('quot_abc_123'),
        throwsA(predicate((e) => e.toString().contains('Quotation has already expired.'))),
      );
    });
  });

  group('VendorQuotationDialog - Calculation & Form Validation', () {
    testWidgets('6. Dynamic line items calculate subtotal and total in integer paise', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      bool submitted = false;
      final mockClient = MockClient((request) async {
        submitted = true;
        return http.Response(
          jsonEncode({'success': true, 'quotation': sampleQuotationJson}),
          201,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      await tester.pumpWidget(
        buildTestApp(
          Scaffold(
            body: VendorQuotationDialog(
              enquiry: sampleEnquiry,
              apiService: service,
              onSuccess: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Create Structured Quotation'), findsOneWidget);
      expect(find.text('Subtotal:'), findsOneWidget);
      expect(find.text('Total Payable:'), findsOneWidget);
      expect(find.text('₹0.00'), findsNWidgets(3)); // Subtotal, Tax, and Total

      // Enter Description and Rate for first item
      await tester.enterText(find.byKey(const Key('item_desc_0')), 'Photography Service');
      await tester.enterText(find.byKey(const Key('item_rate_0')), '25000');
      await tester.pumpAndSettle();

      expect(find.text('₹25,000.00'), findsNWidgets(2)); // Subtotal and Total

      // Add tax
      await tester.enterText(find.byKey(const Key('tax_input')), '4500');
      await tester.pumpAndSettle();

      expect(find.text('₹25,000.00'), findsOneWidget); // Subtotal
      expect(find.text('₹4,500.00'), findsOneWidget); // Tax
      expect(find.text('₹29,500.00'), findsOneWidget); // Total

      // Add second line item
      await tester.tap(find.byKey(const Key('add_line_item_button')));
      await tester.pumpAndSettle();

      // Enter second item description and rate
      await tester.enterText(find.byKey(const Key('item_desc_1')), 'Drone Shots');
      await tester.enterText(find.byKey(const Key('item_rate_1')), '5000');
      await tester.pumpAndSettle();

      expect(find.text('₹30,000.00'), findsOneWidget); // Subtotal (25000 + 5000)
      expect(find.text('₹4,500.00'), findsOneWidget); // Tax
      expect(find.text('₹34,500.00'), findsOneWidget); // Total (30000 + 4500)

      // Submit Quotation
      await tester.tap(find.byKey(const Key('submit_quotation_button')));
      await tester.pumpAndSettle();

      expect(submitted, isTrue);
    });
  });

  group('CustomerQuotationDialog & Review Flow', () {
    testWidgets('7. Customer views quotation breakdown, validity, and line items', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'quotations': [sampleQuotationJson],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      await tester.pumpWidget(
        buildTestApp(
          Scaffold(
            body: CustomerQuotationDialog(
              enquiry: sampleQuotedEnquiry,
              apiService: service,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('QUOTATION DETAILS'), findsOneWidget);
      expect(find.text('Full Day Photography'), findsOneWidget);
      expect(find.text('Drone Operator'), findsOneWidget);
      expect(find.text('₹59,000.00'), findsOneWidget);
      expect(find.text('₹55,000.00'), findsOneWidget);
      expect(find.text('₹4,000.00'), findsOneWidget);
      expect(find.text('Edited Photos'), findsOneWidget);
      expect(find.text('Teaser Reel'), findsOneWidget);
      expect(find.text('Raw footage hard drive'), findsOneWidget);
      expect(find.text('Advance confirmation required.'), findsOneWidget);
      expect(find.byKey(const Key('accept_quote_btn')), findsOneWidget);
      expect(find.byKey(const Key('decline_quote_btn')), findsOneWidget);
    });

    testWidgets('8. Customer explicitly accepts quotation to create confirmed booking', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      bool acceptCalled = false;
      final mockClient = MockClient((request) async {
        if (request.method == 'GET') {
          return http.Response(
            jsonEncode({'success': true, 'quotations': [sampleQuotationJson]}),
            200,
            headers: {'content-type': 'application/json'},
          );
        } else if (request.method == 'POST' && request.url.path.endsWith('/accept')) {
          acceptCalled = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'quotation': {
                ...sampleQuotationJson,
                'status': 'accepted',
                'bookingId': 'book_real_999',
              },
              'bookingId': 'book_real_999',
              'allocationId': 'alloc_real_999',
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not found', 404);
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      await tester.pumpWidget(
        buildTestApp(
          Scaffold(
            body: CustomerQuotationDialog(
              enquiry: sampleQuotedEnquiry,
              apiService: service,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Accept & Book
      await tester.tap(find.byKey(const Key('accept_quote_btn')));
      await tester.pumpAndSettle();

      // Confirmation dialog pops up
      expect(find.text('Confirm Quotation Acceptance'), findsOneWidget);
      expect(find.text('Accept & Book'), findsNWidgets(2)); // Button in dialog and background

      // Confirm in dialog
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Accept & Book')));
      await tester.pumpAndSettle();

      expect(acceptCalled, isTrue);
      expect(find.textContaining('Quotation accepted!'), findsOneWidget);
      expect(find.textContaining('book_real_999'), findsOneWidget);
      expect(find.text('✓ QUOTATION ACCEPTED & BOOKED'), findsOneWidget);
    });

    testWidgets('9. CustomerEnquiriesScreen renders Review Quotation button for quoted enquiries', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': true, 'quotations': [sampleQuotationJson]}),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      final stream = Stream.value([sampleQuotedEnquiry]);

      await tester.pumpWidget(
        buildTestApp(
          CustomerEnquiriesScreen(
            testCustomerId: 'cust_priya_123',
            enquiryStream: stream,
            quotationApiService: service,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('review_quote_enq_quoted_202')), findsOneWidget);
      expect(find.text('Review Quotation & Book'), findsOneWidget);

      // Tap to open quotation dialog
      await tester.tap(find.byKey(const Key('review_quote_enq_quoted_202')));
      await tester.pumpAndSettle();

      expect(find.byType(CustomerQuotationDialog), findsOneWidget);
      expect(find.text('QUOTATION DETAILS'), findsOneWidget);
      expect(find.text('₹59,000.00'), findsOneWidget);
    });

    testWidgets('10. Customer declines quotation with optional reason', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      bool declineCalled = false;
      final mockClient = MockClient((request) async {
        if (request.method == 'GET') {
          return http.Response(
            jsonEncode({'success': true, 'quotations': [sampleQuotationJson]}),
            200,
            headers: {'content-type': 'application/json'},
          );
        } else if (request.method == 'POST' && request.url.path.endsWith('/decline')) {
          declineCalled = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'quotation': {
                ...sampleQuotationJson,
                'status': 'declined',
                'declineReason': 'Event canceled',
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('Not found', 404);
      });

      final service = QuotationApiService(
        client: mockClient,
        baseUrl: 'http://localhost:3000/api/quotations',
        tokenProvider: () async => 'mock_token',
      );

      await tester.pumpWidget(
        buildTestApp(
          Scaffold(
            body: CustomerQuotationDialog(
              enquiry: sampleQuotedEnquiry,
              apiService: service,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Decline Quote
      await tester.tap(find.byKey(const Key('decline_quote_btn')));
      await tester.pumpAndSettle();

      expect(find.text('Decline Quotation'), findsOneWidget);

      // Enter decline reason
      await tester.enterText(find.byType(TextField), 'Event canceled');
      await tester.pumpAndSettle();

      // Tap confirm decline in dialog
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Decline Quote')));
      await tester.pumpAndSettle();

      expect(declineCalled, isTrue);
      expect(find.text('QUOTATION DECLINED'), findsOneWidget);
    });
  });
}
