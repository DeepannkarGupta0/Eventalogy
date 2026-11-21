import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/login_screen.dart';
import '../../features/user/shell/user_shell_screen.dart';
import '../../features/user/home/user_home_view.dart';
import '../../features/user/planner/user_planner_view.dart';
import '../../features/user/planner/event_planner_screen.dart';
import '../../features/user/profile/user_profile_view.dart';
import '../../features/user/events/screens/my_events_screen.dart';
import '../../features/user/events/screens/event_detail_screen.dart';
import '../../features/user/enquiries/screens/customer_enquiries_screen.dart';
import '../../features/user/catalog/screens/vendor_listing_screen.dart';
import '../../features/user/catalog/screens/venue_listing_screen.dart';
import '../../features/user/catalog/screens/vendor_detail_screen.dart';
import '../../features/user/catalog/screens/venue_detail_screen.dart';
import '../../features/admin/admin_dashboard_screen.dart';
import '../../features/vendor/shell/vendor_shell_screen.dart';
import '../../features/vendor/dashboard/vendor_dashboard_view.dart';
import '../../features/vendor/enquiries/vendor_enquiries_view.dart';
import '../../features/vendor/bookings/vendor_bookings_view.dart';
import '../../features/vendor/settlements/vendor_settlements_ledger_view.dart';
import '../../features/vendor/profile/vendor_profile_view.dart';
import '../../features/vendor/availability/vendor_availability_view.dart';
import '../../features/auth/signup_screen.dart';
import '../../services/auth_state_notifier.dart';
import '../../features/user/whatsapp/whatsapp_link_screen.dart';
import '../../features/user/profile/become_vendor_screen.dart';

import '../../features/user/bookings/screens/customer_bookings_screen.dart';
import '../../features/user/bookings/screens/booking_checkout_screen.dart';
import '../../features/user/procurement/screens/event_procurement_screen.dart';
import '../../features/user/operations/screens/live_run_of_show_screen.dart';
import '../../features/user/operations/screens/crew_station_screen.dart';
import '../../features/vendor/rfq/vendor_rfq_inbox_view.dart';
import '../../features/auth/splash_screen.dart';

class LoadingScreen extends StatelessWidget {
  const LoadingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

final appRouter = GoRouter(
  initialLocation: '/',
  refreshListenable: authStateNotifier,
  redirect: (context, state) {
    // If it's the splash screen, let it be. Splash screen will handle its own routing.
    if (state.matchedLocation == '/') {
      return null;
    }

    if (authStateNotifier.isLoading) {
      return '/loading';
    }

    final isLoggedIn = authStateNotifier.isAuthenticated;
    final role = authStateNotifier.role;
    final isGoingToLoginOrSignup =
        state.matchedLocation == '/login' || state.matchedLocation == '/signup';

    // 1. Unauthenticated users must log in
    if (!isLoggedIn) {
      if (isGoingToLoginOrSignup || state.matchedLocation == '/loading') {
        return null;
      }
      return '/login';
    }

    // 2. Authenticated users: redirect away from login/signup/loading
    if (isGoingToLoginOrSignup || state.matchedLocation == '/loading') {
      if (role == 'admin') return '/admin';
      if (role == 'vendor') return '/vendor';
      return '/home';
    }

    // 3. Admin Routing
    if (role == 'admin') {
      if (state.matchedLocation.startsWith('/admin')) {
        return null;
      }
      return '/admin';
    }

    // 4. Non-admins cannot access Admin routes
    if (state.matchedLocation.startsWith('/admin')) {
      if (role == 'vendor') return '/vendor';
      return '/home';
    }

    // 5. Vendor Routing: Vendors must ONLY access vendor routes
    if (role == 'vendor') {
      if (!state.matchedLocation.startsWith('/vendor')) {
        return '/vendor';
      }
      return null;
    }

    // 6. User Routing: Regular users must NOT access vendor operational routes
    if (state.matchedLocation.startsWith('/vendor')) {
      return '/become-vendor';
    }

    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (context, state) => const SplashScreen()),
    GoRoute(
      path: '/loading',
      builder: (context, state) => const LoadingScreen(),
    ),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
    GoRoute(
      path: '/admin',
      builder: (context, state) => const AdminDashboardScreen(),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return VendorShellScreen(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vendor',
              builder: (context, state) => const VendorDashboardView(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vendor/enquiries',
              builder: (context, state) => const VendorEnquiriesView(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vendor/bookings',
              builder: (context, state) => const VendorBookingsView(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vendor/settlements',
              builder: (context, state) => const VendorSettlementsLedgerView(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vendor/profile',
              builder: (context, state) => const VendorProfileView(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/vendor/availability',
      builder: (context, state) => const VendorAvailabilityView(),
    ),
    GoRoute(
      path: '/vendor/rfqs',
      builder: (context, state) {
        final vendorId = state.uri.queryParameters['vendorId'];
        final vendorName = state.uri.queryParameters['vendorName'];
        return VendorRfqInboxView(
          vendorId: vendorId,
          vendorName: vendorName,
        );
      },
    ),
    GoRoute(
      path: '/my-events',
      builder: (context, state) => const MyEventsScreen(),
    ),
    GoRoute(
      path: '/my-events/:id',
      builder: (context, state) =>
          EventDetailScreen(eventId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/procurement/:workflowId',
      builder: (context, state) {
        final workflowId = state.pathParameters['workflowId']!;
        final extra = state.extra as Map<String, dynamic>?;
        return EventProcurementScreen(
          workflowId: workflowId,
          eventName: extra?['eventName'] as String?,
          rfqBatchId: extra?['rfqBatchId'] as String?,
        );
      },
    ),
    GoRoute(
      path: '/operations/live-ros',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>?;
        final eventId = extra?['eventId'] as String? ?? 'live-event-current';
        final eventTitle = extra?['eventTitle'] as String?;
        return LiveRunOfShowScreen(
          eventId: eventId,
          eventTitle: eventTitle,
        );
      },
    ),
    GoRoute(
      path: '/operations/session/:eventId/station/:stationId',
      builder: (context, state) {
        final eventId = state.pathParameters['eventId'] ?? 'live-event-current';
        final stationId = state.pathParameters['stationId'] ?? 'foh_audio';
        final extra = state.extra as Map<String, dynamic>?;
        final eventTitle = extra?['eventTitle'] as String?;
        return CrewStationScreen(
          eventId: eventId,
          initialStationId: stationId,
          eventTitle: eventTitle,
        );
      },
    ),
    GoRoute(
      path: '/my-enquiries',
      builder: (context, state) => const CustomerEnquiriesScreen(),
    ),
    GoRoute(
      path: '/my-bookings',
      builder: (context, state) => const CustomerBookingsScreen(),
    ),
    GoRoute(
      path: '/booking-checkout/:id',
      builder: (context, state) =>
          BookingCheckoutScreen(bookingId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/link-whatsapp',
      builder: (context, state) => const WhatsAppLinkScreen(),
    ),
    GoRoute(
      path: '/become-vendor',
      builder: (context, state) => const BecomeVendorScreen(),
    ),
    GoRoute(
      path: '/venues',
      builder: (context, state) => const VenueListingScreen(),
    ),
    GoRoute(
      path: '/venues/:id',
      builder: (context, state) =>
          VenueDetailScreen(venueId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/vendors',
      builder: (context, state) {
        final categoryId = state.uri.queryParameters['categoryId'];
        return VendorListingScreen(categoryId: categoryId);
      },
    ),
    GoRoute(
      path: '/vendors/:id',
      builder: (context, state) =>
          VendorDetailScreen(vendorId: state.pathParameters['id']!),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return UserShellScreen(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, state) => const UserHomeView(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/vendors_tab', // Remapped to Browse / Vendors
              builder: (context, state) => const VendorListingScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/planner',
              builder: (context, state) => const UserPlannerView(),
              routes: [
                GoRoute(
                  path: 'details/:id',
                  builder: (context, state) {
                    final id = state.pathParameters['id']!;
                    return EventPlannerScreen(eventTypeId: id);
                  },
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profile',
              builder: (context, state) => const UserProfileView(),
            ),
          ],
        ),
      ],
    ),
  ],
);
