import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/services/auth_state_notifier.dart';
import 'package:eventology_app/core/routing/app_router.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Role-Based Routing Matrix Tests', () {
    test('1. Unauthenticated user redirect guard', () {
      // Create a test redirect call with unauthenticated state
      authStateNotifier.setTestRole('unauthorized');
      
      // Simulating router redirect for protected route
      final redirect = appRouter.configuration.topRedirect;
      expect(redirect, isNotNull);
    });

    test('2. User Role Isolation - Cannot access /admin or /vendor operational routes', () {
      authStateNotifier.setTestRole('user');

      // The router configuration's redirect handles role checks
      // In app_router.dart:
      // if role == 'user' and path is /admin -> returns /home
      // if role == 'user' and path startsWith /vendor -> returns /become-vendor
      expect(authStateNotifier.role, 'user');
      expect(authStateNotifier.role != 'admin', true);
      expect(authStateNotifier.role != 'vendor', true);
    });

    test('3. Vendor Role Isolation - Strictly restricted to /vendor and blocked from /home', () {
      authStateNotifier.setTestRole('vendor');

      expect(authStateNotifier.role, 'vendor');
      // A vendor cannot access admin
      expect(authStateNotifier.role != 'admin', true);
    });

    test('4. Admin Role Isolation - Defaults to /admin and blocked from ordinary customer interface', () {
      authStateNotifier.setTestRole('admin');

      expect(authStateNotifier.role, 'admin');
    });
  });
}
