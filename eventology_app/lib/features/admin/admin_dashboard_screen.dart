import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../core/theme/app_colors.dart';

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
import 'admin_audit_logs_tab.dart';
import 'admin_settings_tab.dart';
import 'admin_settlements_tab.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> with SingleTickerProviderStateMixin {
  int _selectedConsoleIndex = 0; // 0 = Overview, 1 = Catalog & KYC, 2 = Escrow & Finance, 3 = Live Ops, 4 = Security
  int _catalogSubIndex = 0;      // 0 = Vendors, 1 = Venues, 2 = Services, 3 = Packages, 4 = Locations
  int _financeSubIndex = 0;      // 0 = Settlements, 1 = Bookings & Refund Queue, 2 = Payments, 3 = Allocations
  int _opsSubIndex = 0;          // 0 = Live Events, 1 = Enquiries, 2 = Reviews
  int _securitySubIndex = 0;     // 0 = Audit Logs, 1 = Notifications, 2 = Settings

  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  final List<String> _consoleTitles = [
    'Command Center',
    'Catalog & KYC',
    'Escrow & Finance',
    'Live Operations',
    'Security & Audit',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFF0B0E14),
      drawer: _buildDrawer(),
      appBar: AppBar(
        backgroundColor: const Color(0xFF10141E),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
              ),
              child: const Text(
                'OPS CONSOLE',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.0,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              _consoleTitles[_selectedConsoleIndex],
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
            tooltip: 'Sign Out',
            onPressed: () async {
              final router = GoRouter.of(context);
              await FirebaseAuth.instance.signOut();
              if (context.mounted) {
                router.go('/login');
              }
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _buildCurrentConsoleBody(),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF10141E),
          border: Border(top: BorderSide(color: Color(0xFF1E2638), width: 1)),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildBottomNavItem(0, Icons.dashboard_rounded, 'Command'),
                _buildBottomNavItem(1, Icons.verified_user_rounded, 'Catalog & KYC'),
                _buildBottomNavItem(2, Icons.account_balance_wallet_rounded, 'Finance'),
                _buildBottomNavItem(3, Icons.live_tv_rounded, 'Live Ops'),
                _buildBottomNavItem(4, Icons.security_rounded, 'Security'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNavItem(int index, IconData icon, String label) {
    final isSelected = _selectedConsoleIndex == index;
    return InkWell(
      onTap: () => setState(() => _selectedConsoleIndex = index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.primary : AppColors.textSecondary,
              size: 20,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentConsoleBody() {
    switch (_selectedConsoleIndex) {
      case 0:
        return _buildCommandCenter();
      case 1:
        return _buildCatalogConsole();
      case 2:
        return _buildFinanceConsole();
      case 3:
        return _buildLiveOpsConsole();
      case 4:
        return _buildSecurityConsole();
      default:
        return _buildCommandCenter();
    }
  }

  // ── Console 0: Executive Command Center Overview ────────────────────────
  Widget _buildCommandCenter() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // KPI Metric Ribbon
          const Text(
            'Executive Platform Metrics',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildKpiCard('Gross GMV', '₹1.48 Cr', Icons.show_chart_rounded, const Color(0xFF10B981)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKpiCard('Escrow Held', '₹42.5 L', Icons.lock_clock_rounded, AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildKpiCard('Active Live Gigs', '6', Icons.live_tv_rounded, Colors.purpleAccent),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKpiCard('Pending KYC', '4', Icons.pending_actions_rounded, Colors.orangeAccent),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Operational Quick Action Tiles
          const Text(
            'Operational Consoles',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          _buildConsoleAccessTile(
            title: 'Catalog & KYC Governance',
            subtitle: 'Review pending vendor KYC, physical venue audits & service taxonomy',
            icon: Icons.verified_user_rounded,
            badge: '4 Pending KYC',
            badgeColor: Colors.orangeAccent,
            onTap: () => setState(() => _selectedConsoleIndex = 1),
          ),
          const SizedBox(height: 12),
          _buildConsoleAccessTile(
            title: 'Escrow & Financial Operations',
            subtitle: 'Authorize milestone releases, inspect Razorpay vault & process refunds',
            icon: Icons.account_balance_wallet_rounded,
            badge: '8 Payouts Ready',
            badgeColor: const Color(0xFF10B981),
            onTap: () => setState(() => _selectedConsoleIndex = 2),
          ),
          const SizedBox(height: 12),
          _buildConsoleAccessTile(
            title: 'Live Event Production Oversight',
            subtitle: 'Monitor active shows, 10:00 PM noise curfew sentinels & RFQ dispatch health',
            icon: Icons.live_tv_rounded,
            badge: '6 Shows Live',
            badgeColor: Colors.purpleAccent,
            onTap: () => setState(() => _selectedConsoleIndex = 3),
          ),
          const SizedBox(height: 12),
          _buildConsoleAccessTile(
            title: 'Platform Security & Audit Trails',
            subtitle: 'Inspect tamper-proof system audit logs, user permissions & platform fees',
            icon: Icons.security_rounded,
            badge: '100% Verified',
            badgeColor: Colors.blueAccent,
            onTap: () => setState(() => _selectedConsoleIndex = 4),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildKpiCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF141824),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 22),
              Text(
                value,
                style: TextStyle(
                  color: color,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConsoleAccessTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required String badge,
    required Color badgeColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF141824),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          badge,
                          style: TextStyle(color: badgeColor, fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  // ── Console 1: Catalog & KYC Governance ─────────────────────────────────
  Widget _buildCatalogConsole() {
    final subTabs = ['Vendors (KYC)', 'Venues (Audits)', 'Services', 'Packages', 'Locations'];
    return Column(
      children: [
        _buildSubTabSelector(subTabs, _catalogSubIndex, (i) => setState(() => _catalogSubIndex = i)),
        Expanded(
          child: switch (_catalogSubIndex) {
            0 => const AdminVendorsTab(),
            1 => const AdminVenuesTab(),
            2 => const AdminServicesTab(),
            3 => const AdminPackagesTab(),
            _ => const AdminLocationsTab(),
          },
        ),
      ],
    );
  }

  // ── Console 2: Escrow & Financial Operations ────────────────────────────
  Widget _buildFinanceConsole() {
    final subTabs = ['Settlements Ledger', 'Bookings & Refunds', 'Payments Vault', 'Allocations'];
    return Column(
      children: [
        _buildSubTabSelector(subTabs, _financeSubIndex, (i) => setState(() => _financeSubIndex = i)),
        Expanded(
          child: switch (_financeSubIndex) {
            0 => const AdminSettlementsTab(),
            1 => const AdminBookingsTab(),
            2 => const AdminPaymentsTab(),
            _ => const AdminAllocationsTab(),
          },
        ),
      ],
    );
  }

  // ── Console 3: Live Event Production Oversight ──────────────────────────
  Widget _buildLiveOpsConsole() {
    final subTabs = ['Live Events', 'Enquiries & RFQs', 'Client Reviews'];
    return Column(
      children: [
        _buildSubTabSelector(subTabs, _opsSubIndex, (i) => setState(() => _opsSubIndex = i)),
        Expanded(
          child: switch (_opsSubIndex) {
            0 => const AdminEventsTab(),
            1 => const AdminEnquiriesTab(),
            _ => const AdminReviewsTab(),
          },
        ),
      ],
    );
  }

  // ── Console 4: Platform Security & Audit Trails ─────────────────────────
  Widget _buildSecurityConsole() {
    final subTabs = ['System Audit Logs', 'Notifications', 'Platform Settings'];
    return Column(
      children: [
        _buildSubTabSelector(subTabs, _securitySubIndex, (i) => setState(() => _securitySubIndex = i)),
        Expanded(
          child: switch (_securitySubIndex) {
            0 => const AdminAuditLogsTab(),
            1 => const AdminNotificationsTab(),
            _ => const AdminSettingsTab(),
          },
        ),
      ],
    );
  }

  Widget _buildSubTabSelector(List<String> tabs, int activeIndex, ValueChanged<int> onSelect) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: const BoxDecoration(
        color: Color(0xFF141824),
        border: Border(bottom: BorderSide(color: Color(0xFF1E2638), width: 1)),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: tabs.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final isSelected = activeIndex == index;
          return InkWell(
            onTap: () => onSelect(index),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected ? AppColors.primary : Colors.white.withValues(alpha: 0.1),
                ),
              ),
              child: Center(
                child: Text(
                  tabs[index],
                  style: TextStyle(
                    color: isSelected ? Colors.black : Colors.white70,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDrawer() {
    return Drawer(
      backgroundColor: const Color(0xFF0B0E14),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const DrawerHeader(
            decoration: BoxDecoration(color: Color(0xFF141824)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(
                  Icons.admin_panel_settings_rounded,
                  color: AppColors.primary,
                  size: 40,
                ),
                SizedBox(height: 10),
                Text(
                  'EVENTOLOGY ADMIN',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                Text(
                  'Operations & Escrow Command Center',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dashboard_rounded, color: AppColors.primary),
            title: const Text('Command Center', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _selectedConsoleIndex = 0);
            },
          ),
          ListTile(
            leading: const Icon(Icons.verified_user_rounded, color: AppColors.primary),
            title: const Text('Catalog & KYC Governance', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _selectedConsoleIndex = 1);
            },
          ),
          ListTile(
            leading: const Icon(Icons.account_balance_wallet_rounded, color: AppColors.primary),
            title: const Text('Escrow & Financial Operations', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _selectedConsoleIndex = 2);
            },
          ),
          ListTile(
            leading: const Icon(Icons.live_tv_rounded, color: AppColors.primary),
            title: const Text('Live Production Oversight', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _selectedConsoleIndex = 3);
            },
          ),
          ListTile(
            leading: const Icon(Icons.security_rounded, color: AppColors.primary),
            title: const Text('Platform Security & Audit', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              setState(() => _selectedConsoleIndex = 4);
            },
          ),
          const Divider(color: Color(0xFF1E2638)),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: Colors.redAccent),
            title: const Text('Sign Out', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
            onTap: () async {
              final router = GoRouter.of(context);
              Navigator.pop(context);
              await FirebaseAuth.instance.signOut();
              router.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
