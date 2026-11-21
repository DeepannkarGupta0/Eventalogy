import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/features/user/operations/screens/crew_station_screen.dart';

void main() {
  group('Milestone 56: CrewStationScreen Widget Tests', () {
    testWidgets('1. Renders Station Header, Ready Toggle, and Departmental Focus Callout', (tester) async {
      tester.view.physicalSize = const Size(1000, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: CrewStationScreen(
            eventId: 'test-event-station-56',
            initialStationId: 'foh_audio',
            eventTitle: 'National Tech Summit',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Header components
      expect(find.text('FOH Audio Mix'), findsAtLeastNWidgets(1));
      expect(find.textContaining('A1 Audio Lead'), findsOneWidget);
      expect(find.text('STATION STATUS: CHECKED_IN'), findsOneWidget);

      // Readiness button
      expect(find.text('STATION READY (ACKNOWLEDGED)'), findsOneWidget);

      // Departmental Callout
      expect(find.text('YOUR STATION CALLOUT'), findsOneWidget);
      expect(find.text('UPCOMING CUES FOR THIS STATION'), findsOneWidget);
    });

    testWidgets('2. Tapping Readiness toggle toggles station status', (tester) async {
      tester.view.physicalSize = const Size(1000, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: CrewStationScreen(
            eventId: 'test-event-station-56',
            initialStationId: 'foh_audio',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Tap readiness button
      await tester.tap(find.text('STATION READY (ACKNOWLEDGED)'));
      await tester.pumpAndSettle();

      // Telemetry status toggles to STANDBY
      expect(find.text('STATION STATUS: STANDBY'), findsOneWidget);
      expect(find.text('ACKNOWLEDGE STANDBY (TAP READY)'), findsOneWidget);
    });

    testWidgets('3. Opening Report Issue dialog allows selecting preset and dismissing', (tester) async {
      tester.view.physicalSize = const Size(1000, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: CrewStationScreen(
            eventId: 'test-event-station-56',
            initialStationId: 'foh_audio',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Tap Report Issue chip
      await tester.tap(find.text('Report Issue'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Report Issue: FOH Audio Mix'), findsOneWidget);
      expect(find.text('Signal / RF Dropout'), findsOneWidget);

      // Select preset
      await tester.tap(find.text('Signal / RF Dropout'));
      await tester.pumpAndSettle();

      // Dismiss dialog
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Report Issue: FOH Audio Mix'), findsNothing);
    });
  });
}

