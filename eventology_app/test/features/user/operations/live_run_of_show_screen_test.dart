import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/features/user/operations/screens/live_run_of_show_screen.dart';

void main() {
  group('Milestone 51: LiveRunOfShowScreen Widget Tests', () {
    testWidgets('1. Renders Master SMPTE Clock, Live ROS badge, and Hero Cue Cockpit', (tester) async {
      tester.view.physicalSize = const Size(1200, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: LiveRunOfShowScreen(
            eventId: 'test-event-51',
            eventTitle: 'National Tech Summit Keynote Gala',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Header and master clock
      expect(find.text('LIVE ROS'), findsOneWidget);
      expect(find.text('National Tech Summit Keynote Gala'), findsOneWidget);
      expect(find.text('LOCAL SMPTE'), findsOneWidget);
      expect(find.text('ALL-STOP'), findsOneWidget);

      // Hero Active Cue Cockpit
      expect(find.text('CUE-01'), findsAtLeastNWidgets(1));
      expect(find.text('Doors Open & Walk-in BGM'), findsAtLeastNWidgets(1));
      expect(find.text('STANDBY'), findsAtLeastNWidgets(1));
      expect(find.text('GO'), findsOneWidget);
      expect(find.text('COMPLETE'), findsOneWidget);

      // Technical Cues
      expect(find.text('Audio Cue'), findsOneWidget);
      expect(find.text('Lighting Preset'), findsOneWidget);
      expect(find.text('Video Content'), findsOneWidget);
    });

    testWidgets('2. Renders all 7 Production Crew Stations and their telemetry status', (tester) async {
      tester.view.physicalSize = const Size(1200, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: LiveRunOfShowScreen(
            eventId: 'test-event-51',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('CREW STATION TELEMETRY'), findsOneWidget);
      expect(find.text('FOH Audio Mix'), findsOneWidget);
      expect(find.text('Lighting Console'), findsOneWidget);
      expect(find.text('Video & LED Control'), findsOneWidget);
      expect(find.text('Stage Left Caller'), findsOneWidget);
      expect(find.text('Rigging & Truss'), findsOneWidget);
      expect(find.text('Banquet & Food'), findsOneWidget);
      expect(find.text('Perimeter Safety'), findsOneWidget);
    });

    testWidgets('3. Engaging Emergency All-Stop opens confirmation dialog', (tester) async {
      tester.view.physicalSize = const Size(1200, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: LiveRunOfShowScreen(
            eventId: 'test-event-51',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Tap ALL-STOP button
      await tester.tap(find.text('ALL-STOP'));
      await tester.pumpAndSettle();

      // Verify dialog is displayed
      expect(find.text('EMERGENCY ALL-STOP'), findsOneWidget);
      expect(find.text('Emergency Hold Reason'), findsOneWidget);
      expect(find.text('ENGAGE ALL-STOP'), findsOneWidget);

      // Dismiss dialog
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(find.text('EMERGENCY ALL-STOP'), findsNothing);
    });
  });
}

