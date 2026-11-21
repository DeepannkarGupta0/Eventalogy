import 'dart:io';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'firestore_config.dart';

class EmulatorConfig {
  static const bool useEmulator = bool.fromEnvironment(
    'USE_FIREBASE_EMULATOR',
    defaultValue: false,
  );

  static const String emulatorHostOverride = String.fromEnvironment(
    'FIREBASE_EMULATOR_HOST',
    defaultValue: '',
  );

  static const int firestorePort = int.fromEnvironment(
    'FIRESTORE_EMULATOR_PORT',
    defaultValue: 8080,
  );

  static const int authPort = int.fromEnvironment(
    'FIREBASE_AUTH_EMULATOR_PORT',
    defaultValue: 9099,
  );

  /// Resolves the default emulator host based on the execution platform:
  /// - Android emulator: 10.0.2.2
  /// - iOS simulator / Web / Desktop: 127.0.0.1
  /// Can be overridden via --dart-define=FIREBASE_EMULATOR_HOST=... (e.g. for physical devices on LAN)
  static String get defaultHost {
    if (emulatorHostOverride.isNotEmpty) {
      return emulatorHostOverride;
    }
    if (!kIsWeb && Platform.isAndroid) {
      return '10.0.2.2';
    }
    return '127.0.0.1';
  }

  static bool _configured = false;
  static bool get isConfigured => _configured;

  /// Explicitly configures Firestore and Auth emulators.
  /// Throws if emulator configuration fails so it NEVER silently falls back to production.
  static void configure({String? host}) {
    if (_configured) return;

    final targetHost = host ?? defaultHost;
    // When using 127.0.0.1 (e.g. physical device via adb reverse or desktop/web),
    // disable automatic host mapping so Android SDK does not remap 127.0.0.1 to 10.0.2.2.
    final bool autoMap = targetHost != '127.0.0.1' && targetHost != 'localhost';
    try {
      FirestoreConfig.instance.useFirestoreEmulator(
        targetHost,
        firestorePort,
        automaticHostMapping: autoMap,
      );
      FirebaseAuth.instance.useAuthEmulator(
        targetHost,
        authPort,
        automaticHostMapping: autoMap,
      );
      _configured = true;
      debugPrint('[FirebaseEmulator] Attached to Auth at $targetHost:$authPort and Firestore at $targetHost:$firestorePort (autoMap=$autoMap)');
    } catch (e) {
      throw StateError('[FATAL] Failed to configure Firebase emulators at $targetHost: $e');
    }
  }
}
