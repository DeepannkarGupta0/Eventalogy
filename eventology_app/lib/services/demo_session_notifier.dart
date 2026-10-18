import 'package:flutter/foundation.dart';

enum DemoMode { none, user, vendor }

/// Centralized notifier managing Demo Mode for platform administrators.
///
/// In Demo Mode:
/// - Admin can safely preview customer and vendor interfaces.
/// - Live writes, bookings, enquiries, payments, and Firestore mutations are strictly BLOCKED.
/// - Demo identity is completely isolated from Firebase Auth and Custom Claims.
class DemoSessionNotifier extends ChangeNotifier {
  DemoMode _mode = DemoMode.none;

  DemoMode get mode => _mode;
  bool get isDemoActive => _mode != DemoMode.none;
  bool get isUserDemo => _mode == DemoMode.user;
  bool get isVendorDemo => _mode == DemoMode.vendor;

  /// Activates the read-only User Demo preview
  void enterUserDemo() {
    _mode = DemoMode.user;
    notifyListeners();
  }

  /// Activates the read-only Vendor Demo preview
  void enterVendorDemo() {
    _mode = DemoMode.vendor;
    notifyListeners();
  }

  /// Exits demo mode and returns to normal Admin experience
  void exitDemo() {
    _mode = DemoMode.none;
    notifyListeners();
  }

  /// Safety assertion: throws an [UnsupportedError] if called while Demo Mode is active.
  /// Use this in write/mutation operations to guarantee no production side effects occur.
  void assertMutationAllowed(String actionName) {
    if (isDemoActive) {
      throw UnsupportedError(
        'Mutation blocked: "$actionName" cannot be executed in DEMO MODE. '
        'Demo mode is strictly read-only and prevents all production side effects.',
      );
    }
  }
}

/// Global singleton instance for demo mode management
final demoSessionNotifier = DemoSessionNotifier();
