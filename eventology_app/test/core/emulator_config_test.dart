import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:eventology_app/core/firebase/emulator_config.dart';

void main() {
  group('EmulatorConfig Tests', () {
    test('default configuration is disabled by default for safety', () {
      expect(EmulatorConfig.useEmulator, isFalse);
    });

    test('default ports match Firebase emulator standards', () {
      expect(EmulatorConfig.firestorePort, equals(8080));
      expect(EmulatorConfig.authPort, equals(9099));
    });

    test('defaultHost resolves accurately based on platform', () {
      final host = EmulatorConfig.defaultHost;
      if (Platform.isAndroid) {
        expect(host, equals('10.0.2.2'));
      } else {
        expect(host, equals('127.0.0.1'));
      }
    });
  });
}
