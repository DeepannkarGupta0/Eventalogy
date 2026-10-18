import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:eventology_app/models/vendor_model.dart';
import 'package:eventology_app/features/vendor/vendor_session.dart';
import 'package:eventology_app/features/vendor/enquiries/vendor_enquiries_view.dart';
import 'package:eventology_app/services/firestore/enquiries_repository.dart';

void main() {
  final sampleValidVendor = VendorModel(
    vendorId: 'vendor_photo_real_789',
    userId: 'user_owner_456',
    businessName: 'Apex Studio Photography',
    ownerName: 'Sunita Rao',
    categoryIds: ['cat_photo'],
    serviceIds: ['srv_photo_pro'],
    verified: true,
    status: 'active',
    createdAt: Timestamp.now(),
  );

  Widget buildTestApp(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('VendorAuthWrapper & Session Fallback Protection', () {
    testWidgets('Missing vendor profile displays setup state and never mounts child or dummy session', (tester) async {
      bool childMounted = false;

      await tester.pumpWidget(
        buildTestApp(
          VendorAuthWrapper(
            vendorFuture: Future.value(null), // simulates no vendor doc in Firestore
            child: Builder(
              builder: (context) {
                childMounted = true;
                return const Text('Child Dashboard Loaded');
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify the setup state is displayed
      expect(find.text('Complete Your Business Profile'), findsOneWidget);
      expect(find.byKey(const Key('create_vendor_profile_button')), findsOneWidget);
      expect(find.byKey(const Key('refresh_vendor_profile_button')), findsOneWidget);

      // Child must NOT be mounted
      expect(childMounted, isFalse);
      expect(find.text('Child Dashboard Loaded'), findsNothing);
    });

    testWidgets('Missing vendor profile triggers create profile callback when tapped', (tester) async {
      bool createProfileTapped = false;

      await tester.pumpWidget(
        buildTestApp(
          VendorAuthWrapper(
            vendorFuture: Future.value(null),
            onCreateProfile: () {
              createProfileTapped = true;
            },
            child: const Text('Child Dashboard Loaded'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('create_vendor_profile_button')));
      await tester.pumpAndSettle();

      expect(createProfileTapped, isTrue);
    });

    testWidgets('Valid vendor profile renders VendorSession with real profile ID and mounts child', (tester) async {
      String? resolvedVendorId;

      await tester.pumpWidget(
        buildTestApp(
          VendorAuthWrapper(
            vendorFuture: Future.value(sampleValidVendor),
            child: Builder(
              builder: (context) {
                final sessionVendor = VendorSession.of(context);
                resolvedVendorId = sessionVendor.vendorId;
                return Text('Business: ${sessionVendor.businessName}');
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Complete Your Business Profile'), findsNothing);
      expect(find.text('Business: Apex Studio Photography'), findsOneWidget);
      expect(resolvedVendorId, equals('vendor_photo_real_789'));
      expect(resolvedVendorId, isNot(equals('test_vendor_id')));
    });
  });

  group('EnquiriesRepository & VendorEnquiriesView Guards', () {
    test('EnquiriesRepository.streamVendorEnquiries emits empty list for dummy or empty vendor IDs', () async {
      final emptyResult = await EnquiriesRepository.streamVendorEnquiries('').first;
      expect(emptyResult, isEmpty);

      final dummyResult = await EnquiriesRepository.streamVendorEnquiries('test_vendor_id').first;
      expect(dummyResult, isEmpty);
    });

    testWidgets('VendorEnquiriesView safely displays guard message if vendorId is dummy or empty', (tester) async {
      final dummyVendor = VendorModel(
        vendorId: 'test_vendor_id',
        userId: 'some_uid',
        businessName: 'Dummy',
        ownerName: 'Dummy',
        categoryIds: ['cat_dummy'],
        verified: false,
        status: 'active',
        createdAt: Timestamp.now(),
      );

      await tester.pumpWidget(
        buildTestApp(
          VendorSession(
            vendor: dummyVendor,
            child: const VendorEnquiriesView(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('No valid vendor profile linked to this session.'),
        findsOneWidget,
      );
    });
  });
}
