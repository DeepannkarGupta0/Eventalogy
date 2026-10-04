import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../services/firestore/master_data_repository.dart';

import 'admin_locations_tab.dart';
import 'admin_services_tab.dart';
import 'admin_vendors_tab.dart';
import 'admin_venues_tab.dart';
import 'admin_packages_tab.dart';
import 'admin_events_tab.dart';
import 'admin_enquiries_tab.dart';
import 'admin_bookings_tab.dart';
import 'admin_allocations_tab.dart';
import 'admin_payments_tab.dart';
import 'admin_reviews_tab.dart';
import 'admin_notifications_tab.dart';
import 'admin_ai_plans_tab.dart';
import 'admin_ai_recommendations_tab.dart';
import 'admin_agent_tasks_tab.dart';
import 'admin_agent_logs_tab.dart';
import 'admin_audit_logs_tab.dart';
import 'admin_settings_tab.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  int _selectedIndex = 0;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  final List<Map<String, dynamic>> _tabs = [
    // MASTER DATA
    {
      'title': 'Locations',
      'icon': Icons.location_city,
      'widget': const AdminLocationsTab(),
      'category': 'MASTER DATA',
    },
    {
      'title': 'Services',
      'icon': Icons.design_services,
      'widget': const AdminServicesTab(),
      'category': 'MASTER DATA',
    },
    {
      'title': 'Vendors',
      'icon': Icons.store,
      'widget': const AdminVendorsTab(),
      'category': 'MASTER DATA',
    },
    {
      'title': 'Venues',
      'icon': Icons.business,
      'widget': const AdminVenuesTab(),
      'category': 'MASTER DATA',
    },
    {
      'title': 'Packages',
      'icon': Icons.card_giftcard,
      'widget': const AdminPackagesTab(),
      'category': 'MASTER DATA',
    },
    // OPERATIONS
    {
      'title': 'Events',
      'icon': Icons.event,
      'widget': const AdminEventsTab(),
      'category': 'OPERATIONS',
    },
    {
      'title': 'Enquiries',
      'icon': Icons.help_outline,
      'widget': const AdminEnquiriesTab(),
      'category': 'OPERATIONS',
    },
    {
      'title': 'Bookings',
      'icon': Icons.book_online,
      'widget': const AdminBookingsTab(),
      'category': 'OPERATIONS',
    },
    {
      'title': 'Allocations',
      'icon': Icons.assignment,
      'widget': const AdminAllocationsTab(),
      'category': 'OPERATIONS',
    },
    {
      'title': 'Payments',
      'icon': Icons.payment,
      'widget': const AdminPaymentsTab(),
      'category': 'OPERATIONS',
    },
    {
      'title': 'Reviews',
      'icon': Icons.star,
      'widget': const AdminReviewsTab(),
      'category': 'OPERATIONS',
    },
    // INTELLIGENCE & SYSTEM
    {
      'title': 'Notifications',
      'icon': Icons.notifications,
      'widget': const AdminNotificationsTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
    {
      'title': 'AI Plans',
      'icon': Icons.smart_toy,
      'widget': const AdminAiPlansTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
    {
      'title': 'AI Recs',
      'icon': Icons.recommend,
      'widget': const AdminAiRecommendationsTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
    {
      'title': 'Agent Tasks',
      'icon': Icons.task,
      'widget': const AdminAgentTasksTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
    {
      'title': 'Agent Logs',
      'icon': Icons.history,
      'widget': const AdminAgentLogsTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
    {
      'title': 'Audit Logs',
      'icon': Icons.security,
      'widget': const AdminAuditLogsTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
    {
      'title': 'Settings',
      'icon': Icons.settings,
      'widget': const AdminSettingsTab(),
      'category': 'INTELLIGENCE & SYSTEM',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFF0D0D0F),
      extendBody: true, // For floating nav bar
      drawer: _buildDrawer(),
      appBar: _selectedIndex == 0
          ? null
          : AppBar(
              backgroundColor: AppColors.surface,
              title: Text(
                _selectedIndex == 0
                    ? 'Command Center'
                    : _selectedIndex == 1
                    ? 'Bookings'
                    : _selectedIndex == 3
                    ? 'Vendors'
                    : 'Dashboard',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.black, size: 32),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        color: AppColors.surface,
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            IconButton(
              icon: Icon(
                Icons.dashboard,
                color: _selectedIndex == 0
                    ? AppColors.primary
                    : AppColors.textSecondary,
              ),
              onPressed: () => setState(() => _selectedIndex = 0),
            ),
            IconButton(
              icon: Icon(
                Icons.book_online,
                color: _selectedIndex == 1
                    ? AppColors.primary
                    : AppColors.textSecondary,
              ),
              onPressed: () => setState(() => _selectedIndex = 1),
            ),
            const SizedBox(width: 40), // Space for FAB
            IconButton(
              icon: Icon(
                Icons.store,
                color: _selectedIndex == 3
                    ? AppColors.primary
                    : AppColors.textSecondary,
              ),
              onPressed: () => setState(() => _selectedIndex = 3),
            ),
            IconButton(
              icon: Icon(
                Icons.menu,
                color: _selectedIndex == 4
                    ? AppColors.primary
                    : AppColors.textSecondary,
              ),
              onPressed: () => _scaffoldKey.currentState?.openDrawer(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_selectedIndex == 0) return _buildCommandCenter();
    if (_selectedIndex == 1) return const AdminBookingsTab();
    if (_selectedIndex == 3) return const AdminVendorsTab();
    return const Center(child: Text('Coming Soon'));
  }

  Widget _buildCommandCenter() {
    return SafeArea(
      child: Stack(
        children: [
          // Background Glow
          Positioned(
            top: -100,
            left: -50,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withOpacity(0.05),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.05),
                    blurRadius: 100,
                    spreadRadius: 50,
                  ),
                ],
              ),
            ),
          ),
          SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome back,',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          'COMMAND CENTER',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.05),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.notifications_outlined,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),

                // Stats Row
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        'Active Leads',
                        '14',
                        Icons.leaderboard,
                        AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _buildStatCard(
                        'Pending Approvals',
                        '3',
                        Icons.verified_user,
                        Colors.orangeAccent,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),

                // Action Required Leads
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Action Required',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'View All',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Lead Card 1
                _buildLeadCard(
                  clientName: 'Sarah & John\'s Wedding',
                  date: 'Oct 24, 2026',
                  budget: '₹12,00,000',
                  timerText: '2d 04h 12m Grace Period',
                  isUrgent: true,
                  checklists: [
                    {'name': 'Venue Confirmed', 'done': true},
                    {'name': 'Catering Selected', 'done': true},
                    {'name': 'Photography Pending', 'done': false},
                  ],
                ),
                const SizedBox(height: 16),

                // Lead Card 2
                _buildLeadCard(
                  clientName: 'TechCorp Annual Gala',
                  date: 'Nov 12, 2026',
                  budget: '₹5,50,000',
                  timerText: 'Awaiting Vendor Quotes',
                  isUrgent: false,
                  checklists: [
                    {'name': 'Venue Confirmed', 'done': true},
                    {'name': 'AV Setup Pending', 'done': false},
                  ],
                ),
                const SizedBox(height: 100), // Space for bottom nav
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 24),
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeadCard({
    required String clientName,
    required String date,
    required String budget,
    required String timerText,
    required bool isUrgent,
    required List<Map<String, dynamic>> checklists,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                date,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isUrgent
                      ? Colors.red.withOpacity(0.1)
                      : AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  timerText,
                  style: TextStyle(
                    color: isUrgent ? Colors.redAccent : AppColors.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            clientName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Budget: $budget',
            style: const TextStyle(
              color: AppColors.primary,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.glassBorder),
          const SizedBox(height: 12),
          ...checklists.map(
            (c) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(
                    c['done']
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                    color: c['done']
                        ? AppColors.primary
                        : AppColors.textSecondary,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    c['name'],
                    style: TextStyle(
                      color: c['done'] ? Colors.white : AppColors.textSecondary,
                      fontSize: 12,
                      decoration: c['done'] ? TextDecoration.lineThrough : null,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawer() {
    return Drawer(
      backgroundColor: AppColors.background,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const DrawerHeader(
            decoration: BoxDecoration(color: AppColors.surface),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(
                  Icons.admin_panel_settings_rounded,
                  color: AppColors.primary,
                  size: 48,
                ),
                SizedBox(height: 12),
                Text(
                  'SYSTEM MENU',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.phone_iphone, color: AppColors.primary),
            title: const Text(
              'Switch to User App',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            onTap: () {
              Navigator.pop(context); // close drawer
              context.go('/home'); // Go to the normal user experience
            },
          ),
          const Divider(color: AppColors.glassBorder),
          ..._tabs.map(
            (tab) => ListTile(
              leading: Icon(tab['icon'], color: AppColors.primary),
              title: Text(
                tab['title'],
                style: const TextStyle(color: Colors.white),
              ),
              onTap: () {
                Navigator.pop(context); // close drawer
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (context) => Scaffold(
                      appBar: AppBar(title: Text(tab['title'])),
                      body: tab['widget'],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
