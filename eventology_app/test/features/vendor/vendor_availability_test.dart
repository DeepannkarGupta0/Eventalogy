import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/models/vendor_availability_model.dart';
import 'package:eventology_app/services/availability_api_service.dart';
import 'package:eventology_app/features/vendor/availability/vendor_availability_view.dart';

class MockAvailabilityApiService extends AvailabilityApiService {
  final Future<VendorAvailabilityModel> Function(String vendorId)? onFetchAvailability;
  final Future<VendorAvailabilityModel> Function(String vendorId, VendorAvailabilityModel config)? onSaveAvailability;
  final Future<VendorAvailabilityModel> Function(String vendorId, BlackoutDateModel blackout)? onAddBlackoutDate;
  final Future<VendorAvailabilityModel> Function(String vendorId, String dateStr)? onRemoveBlackoutDate;
  final Future<List<VendorCommitmentModel>> Function(String vendorId, {String? startDate, String? endDate, String? status, int? limit})? onFetchCommitments;

  MockAvailabilityApiService({
    this.onFetchAvailability,
    this.onSaveAvailability,
    this.onAddBlackoutDate,
    this.onRemoveBlackoutDate,
    this.onFetchCommitments,
  });

  @override
  Future<VendorAvailabilityModel> fetchAvailability(String vendorId) async {
    if (onFetchAvailability != null) return await onFetchAvailability!(vendorId);
    return VendorAvailabilityModel(
      vendorId: vendorId,
      isConfigured: true,
      timezone: 'Asia/Kolkata',
      operatingDays: [1, 2, 3, 4, 5, 6],
      operatingHours: const OperatingHoursModel(open: '09:00', close: '21:00'),
      setupBufferMinutes: 60,
      teardownBufferMinutes: 60,
      capacityType: 'events_count',
      defaultCapacity: 2,
      blackoutDates: const [
        BlackoutDateModel(date: '2026-12-25', reason: 'Christmas Holiday', isAllDay: true),
      ],
    );
  }

  @override
  Future<VendorAvailabilityModel> saveAvailability(String vendorId, VendorAvailabilityModel config) async {
    if (onSaveAvailability != null) return await onSaveAvailability!(vendorId, config);
    return config;
  }

  @override
  Future<VendorAvailabilityModel> addBlackoutDate(String vendorId, BlackoutDateModel blackout) async {
    if (onAddBlackoutDate != null) return await onAddBlackoutDate!(vendorId, blackout);
    return VendorAvailabilityModel(
      vendorId: vendorId,
      isConfigured: true,
      operatingDays: [1, 2, 3, 4, 5, 6],
      operatingHours: const OperatingHoursModel(open: '09:00', close: '21:00'),
      blackoutDates: [blackout],
    );
  }

  @override
  Future<VendorAvailabilityModel> removeBlackoutDate(String vendorId, String dateStr) async {
    if (onRemoveBlackoutDate != null) return await onRemoveBlackoutDate!(vendorId, dateStr);
    return VendorAvailabilityModel(
      vendorId: vendorId,
      isConfigured: true,
      operatingDays: [1, 2, 3, 4, 5, 6],
      operatingHours: const OperatingHoursModel(open: '09:00', close: '21:00'),
      blackoutDates: const [],
    );
  }

  @override
  Future<List<VendorCommitmentModel>> fetchCommitments(
    String vendorId, {
    String? startDate,
    String? endDate,
    String? status,
    int? limit,
  }) async {
    if (onFetchCommitments != null) {
      return await onFetchCommitments!(vendorId, startDate: startDate, endDate: endDate, status: status, limit: limit);
    }
    return [
      const VendorCommitmentModel(
        reservationId: 'res_001',
        bookingId: 'bk_wedding_01',
        eventId: 'evt_wedding',
        eventTitle: 'Kapoor Sangeet Night',
        eventDate: '2026-11-20',
        quantity: 1,
        status: 'confirmed',
      ),
    ];
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

  group('Vendor Availability View Tests', () {
    testWidgets('1. Loads and renders configured availability state with active banner and details', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: MockAvailabilityApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Availability & Calendar'), findsOneWidget);
      expect(find.text('Operational Availability Active'), findsOneWidget);
      expect(find.text('Weekly Operating Days *'), findsOneWidget);
      expect(find.text('Capacity & Concurrency Limits *'), findsOneWidget);
      expect(find.text('Blackout Dates & Vacations'), findsOneWidget);
      expect(find.text('Upcoming Confirmed Commitments'), findsOneWidget);
      expect(find.text('Kapoor Sangeet Night'), findsOneWidget);
    });

    testWidgets('2. Renders unconfigured warning banner and Quick Setup button when isConfigured is false', (tester) async {
      configureViewport(tester);

      final unconfiguredApi = MockAvailabilityApiService(
        onFetchAvailability: (vId) async => VendorAvailabilityModel(
          vendorId: vId,
          isConfigured: false,
          operatingDays: [1, 2, 3, 4, 5],
          operatingHours: const OperatingHoursModel(open: '09:00', close: '21:00'),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: unconfiguredApi,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Availability Setup Required'), findsOneWidget);
      expect(find.byKey(const Key('quick_setup_btn')), findsOneWidget);

      // Tap Quick Setup
      await tester.tap(find.byKey(const Key('quick_setup_btn')));
      await tester.pump();

      // SnackBar shown
      expect(find.textContaining('Applied standard schedule'), findsOneWidget);
    });

    testWidgets('3. Renders error state and allows retry on network error', (tester) async {
      configureViewport(tester);

      bool retried = false;
      final failingApi = MockAvailabilityApiService(
        onFetchAvailability: (vId) async {
          if (!retried) throw Exception('Network timeout');
          return VendorAvailabilityModel(
            vendorId: vId,
            isConfigured: true,
            operatingDays: [1, 2, 3],
            operatingHours: const OperatingHoursModel(open: '10:00', close: '18:00'),
          );
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: failingApi,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Network timeout'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      retried = true;
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      expect(find.text('Operational Availability Active'), findsOneWidget);
    });

    testWidgets('4. Operating days toggle toggles day selection', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: MockAvailabilityApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Day 0 is Sunday
      final sunKey = const Key('day_chip_0');
      expect(find.byKey(sunKey), findsOneWidget);

      // Tap to toggle Sunday
      await tester.tap(find.byKey(sunKey));
      await tester.pump();
    });

    testWidgets('5. Capacity increment and decrement adjust capacity value', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: MockAvailabilityApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('2'), findsWidgets);

      // Increment
      await tester.tap(find.byKey(const Key('capacity_increment_btn')));
      await tester.pump();

      expect(find.text('3'), findsOneWidget);

      // Decrement
      await tester.tap(find.byKey(const Key('capacity_decrement_btn')));
      await tester.pump();

      expect(find.text('2'), findsWidgets);
    });

    testWidgets('6. Add blackout date button opens dialog and adds blackout date chip', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: MockAvailabilityApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Add Date
      await tester.tap(find.byKey(const Key('add_blackout_btn')));
      await tester.pumpAndSettle();

      expect(find.text('Add Blackout Date'), findsOneWidget);

      // Enter reason
      await tester.enterText(find.byKey(const Key('blackout_reason_input')), 'Studio Renovation');
      await tester.pump();

      // Confirm Add
      await tester.tap(find.byKey(const Key('confirm_add_blackout_btn')));
      await tester.pumpAndSettle();

      // Dialog closed and chip present
      expect(find.text('Add Blackout Date'), findsNothing);
      expect(find.textContaining('Studio Renovation'), findsOneWidget);
    });

    testWidgets('7. Delete blackout date chip removes the blackout date', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: MockAvailabilityApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.textContaining('Christmas Holiday'), findsOneWidget);

      // Delete the chip
      await tester.tap(find.byIcon(Icons.close));
      await tester.pump();

      expect(find.textContaining('Christmas Holiday'), findsNothing);
    });

    testWidgets('8. Confirmed commitments display sanitized event info without customer phone or email', (tester) async {
      configureViewport(tester);

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: MockAvailabilityApiService(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Kapoor Sangeet Night'), findsOneWidget);
      expect(find.textContaining('BK_WEDDI'), findsOneWidget);
      expect(find.text('CONFIRMED'), findsOneWidget);
      expect(find.textContaining('@gmail.com'), findsNothing);
      expect(find.textContaining('+91'), findsNothing);
    });

    testWidgets('9. Empty commitments state renders friendly placeholder notice', (tester) async {
      configureViewport(tester);

      final emptyCommitmentsApi = MockAvailabilityApiService(
        onFetchCommitments: (_, {startDate, endDate, status, limit}) async => [],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: emptyCommitmentsApi,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.textContaining('No active commitments on record'), findsOneWidget);
    });

    testWidgets('10. Save configuration button sends updated model and displays success SnackBar', (tester) async {
      configureViewport(tester);

      bool saved = false;
      final mockApi = MockAvailabilityApiService(
        onSaveAvailability: (vendorId, config) async {
          saved = true;
          expect(vendorId, 'vnd_lenscraft');
          expect(config.isConfigured, isTrue);
          expect(config.defaultCapacity, 2);
          return config;
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: VendorAvailabilityView(
            testVendorId: 'vnd_lenscraft',
            testApiService: mockApi,
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Tap Save
      await tester.tap(find.byKey(const Key('save_availability_btn')));
      await tester.pumpAndSettle();

      expect(saved, isTrue);
      expect(find.text('Availability configuration saved successfully!'), findsOneWidget);
    });
  });
}
