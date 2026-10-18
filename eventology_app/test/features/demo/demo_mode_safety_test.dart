import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/services/demo_session_notifier.dart';
import 'package:eventology_app/features/demo/widgets/demo_mode_banner.dart';
import 'package:eventology_app/features/demo/screens/user_demo_screen.dart';
import 'package:eventology_app/features/demo/screens/vendor_demo_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Demo Mode Safety & Mutation Prevention Tests', () {
    setUp(() {
      demoSessionNotifier.exitDemo();
    });

    tearDown(() {
      demoSessionNotifier.exitDemo();
    });

    test('1. Mutation guard blocks writes in User Demo mode', () {
      demoSessionNotifier.enterUserDemo();
      expect(demoSessionNotifier.isDemoActive, true);
      expect(demoSessionNotifier.isUserDemo, true);

      expect(
        () => demoSessionNotifier.assertMutationAllowed('Create Real Event Booking'),
        throwsA(isA<UnsupportedError>()),
      );

      expect(
        () => demoSessionNotifier.assertMutationAllowed('Process Razorpay Payment'),
        throwsA(isA<UnsupportedError>()),
      );
    });

    test('2. Mutation guard blocks writes in Vendor Demo mode', () {
      demoSessionNotifier.enterVendorDemo();
      expect(demoSessionNotifier.isDemoActive, true);
      expect(demoSessionNotifier.isVendorDemo, true);

      expect(
        () => demoSessionNotifier.assertMutationAllowed('Accept Live Customer Enquiry'),
        throwsA(isA<UnsupportedError>()),
      );

      expect(
        () => demoSessionNotifier.assertMutationAllowed('Update Production Service Rate'),
        throwsA(isA<UnsupportedError>()),
      );
    });

    test('3. Mutation guard allows operations when Demo Mode is inactive', () {
      demoSessionNotifier.exitDemo();
      expect(demoSessionNotifier.isDemoActive, false);

      // Should complete normally without throwing
      expect(
        () => demoSessionNotifier.assertMutationAllowed('Normal Authorized Write'),
        returnsNormally,
      );
    });

    testWidgets('4. DemoModeBanner displays warning indicator and Exit button', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DemoModeBanner(demoType: 'Customer Preview'),
          ),
        ),
      );

      expect(find.text('DEMO MODE — NO REAL ACTIONS'), findsOneWidget);
      expect(find.text('CUSTOMER PREVIEW'), findsOneWidget);
      expect(find.text('Exit Demo'), findsOneWidget);
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    });

    testWidgets('5. UserDemoScreen renders cleanly with read-only cards', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      demoSessionNotifier.enterUserDemo();

      await tester.pumpWidget(
        const MaterialApp(
          home: UserDemoScreen(),
        ),
      );

      expect(find.text('DEMO MODE — NO REAL ACTIONS'), findsOneWidget);
      expect(find.text('Customer App Preview'), findsOneWidget);
      expect(find.text('Featured Venues (Preview)'), findsOneWidget);
      expect(find.text('The Leela Palace Udaipur'), findsOneWidget);
      expect(find.text('Top Verified Vendors (Preview)'), findsOneWidget);

      // Tap simulated action
      await tester.tap(find.text('Enquire Availability').first);
      await tester.pumpAndSettle();

      expect(find.text('Demo Mode Protected'), findsOneWidget);
      expect(find.text('Understood'), findsOneWidget);

      // Dismiss dialog
      await tester.tap(find.text('Understood'));
      await tester.pumpAndSettle();
      expect(find.text('Demo Mode Protected'), findsNothing);
    });

    testWidgets('6. VendorDemoScreen toggles between Approved and Pending views safely', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      demoSessionNotifier.enterVendorDemo();

      await tester.pumpWidget(
        const MaterialApp(
          home: VendorDemoScreen(),
        ),
      );

      expect(find.text('DEMO MODE — NO REAL ACTIONS'), findsOneWidget);
      expect(find.text('Approved Dashboard'), findsOneWidget);
      expect(find.text('Pending Approval View'), findsOneWidget);

      // In approved dashboard by default
      expect(find.text('Divine Floral & Stage Decor'), findsOneWidget);
      expect(find.text('Incoming Customer Enquiries (Preview)'), findsOneWidget);

      // Switch to Pending Approval View
      await tester.tap(find.text('Pending Approval View'));
      await tester.pumpAndSettle();

      expect(find.text('Registration Pending Approval'), findsOneWidget);
      expect(find.text('Submitted Profile Summary'), findsOneWidget);
      expect(find.text('Approval Progression'), findsOneWidget);
    });
  });
}
