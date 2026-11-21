import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/features/user/operations/screens/live_run_of_show_screen.dart';

void main() {
  group('Milestones 57 & 58: Curfew Recovery Sentinel & Call Sheet Export Widget Tests', () {
    testWidgets('1. Renders Curfew Sentinel and Export buttons in AppBar', (tester) async {
      tester.view.physicalSize = const Size(1200, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: LiveRunOfShowScreen(
            eventId: 'test-event-curfew-export-01',
            eventTitle: 'National AI Summit & Gala',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Header title
      expect(find.text('National AI Summit & Gala'), findsOneWidget);

      // Curfew Sentinel action button
      expect(find.byTooltip('Curfew Sentinel'), findsOneWidget);

      // Export Master Call Sheet popup action
      expect(find.byTooltip('Export Master Call Sheet'), findsOneWidget);
    });

    testWidgets('2. Tapping Curfew Sentinel opens Curfew Recovery Assistant dialog', (tester) async {
      tester.view.physicalSize = const Size(1200, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: LiveRunOfShowScreen(
            eventId: 'test-event-curfew-export-02',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Tap Curfew Sentinel button
      await tester.tap(find.byTooltip('Curfew Sentinel'));
      await tester.pump();
      await tester.pumpAndSettle();

      // Dialog title
      expect(find.text('Curfew Recovery Sentinel'), findsOneWidget);

      // Recovery schedule metrics
      expect(find.text('PROJECTED FINISH'), findsOneWidget);
      expect(find.text('RECOVERED FINISH'), findsOneWidget);
      expect(find.text('CURFEW LIMIT'), findsOneWidget);
      expect(find.text('23:00:00'), findsOneWidget);

      // Recommended buffer reductions
      expect(find.text('Recommended Buffer Reductions:'), findsOneWidget);
      expect(find.text('Apply Curfew Compression'), findsOneWidget);

      // Tap Apply Curfew Compression
      await tester.tap(find.text('Apply Curfew Compression'));
      await tester.pumpAndSettle();

      // Verify snackbar feedback
      expect(
        find.text('AI Curfew Compression applied. Downstream cues recalculated.'),
        findsOneWidget,
      );
    });

    testWidgets('3. Export menu triggers CSV and PDF export dialogs', (tester) async {
      tester.view.physicalSize = const Size(1200, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: LiveRunOfShowScreen(
            eventId: 'test-event-curfew-export-03',
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Open export menu
      await tester.tap(find.byTooltip('Export Master Call Sheet'));
      await tester.pumpAndSettle();

      expect(find.text('Export Call Sheet (PDF)'), findsOneWidget);
      expect(find.text('Export Cue Sheet (CSV)'), findsOneWidget);

      // Tap PDF export
      await tester.tap(find.text('Export Call Sheet (PDF)'));
      await tester.pumpAndSettle();

      // Verifies PDF Ready dialog and SHA-256 hash display
      expect(find.text('Call Sheet PDF Ready'), findsOneWidget);
      expect(find.text('SHA-256 Verification Hash:'), findsOneWidget);
      expect(
        find.textContaining('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
        findsOneWidget,
      );

      // Close dialog
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();

      // Open export menu again and select CSV
      await tester.tap(find.byTooltip('Export Master Call Sheet'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Export Cue Sheet (CSV)'));
      await tester.pumpAndSettle();

      // Verifies CSV snackbar
      expect(find.textContaining('Run of Show Call Sheet exported'), findsOneWidget);
    });
  });
}

