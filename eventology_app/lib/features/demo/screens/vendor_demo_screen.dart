import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../services/demo_session_notifier.dart';
import '../widgets/demo_mode_banner.dart';

class VendorDemoScreen extends StatefulWidget {
  const VendorDemoScreen({super.key});

  @override
  State<VendorDemoScreen> createState() => _VendorDemoScreenState();
}

class _VendorDemoScreenState extends State<VendorDemoScreen> {
  int _selectedView = 0; // 0: Approved Dashboard, 1: Pending Approval View

  void _handleSimulatedAction(String actionTitle) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.glassBorder),
        ),
        title: Row(
          children: const [
            Icon(Icons.shield_outlined, color: AppColors.primary, size: 24),
            SizedBox(width: 10),
            Text(
              'Demo Mode Protected',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Text(
          'Action "$actionTitle" is simulated for administrator preview. Real Firestore mutations, status changes, and customer notifications are completely disabled.',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Understood'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const DemoModeBanner(demoType: 'Vendor Partner Preview'),
          AppBar(
            backgroundColor: AppColors.surface,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: () {
                demoSessionNotifier.exitDemo();
                context.go('/admin');
              },
              tooltip: 'Exit Demo to Admin',
            ),
            title: const Text(
              'Vendor Experience Preview',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            actions: [
              TextButton.icon(
                icon: const Icon(Icons.exit_to_app, color: AppColors.primary, size: 16),
                label: const Text('Exit Demo', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                onPressed: () {
                  demoSessionNotifier.exitDemo();
                  context.go('/admin');
                },
              ),
            ],
          ),

          // View Selector Toggle
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: AppColors.surface,
            child: Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('Approved Dashboard')),
                    selected: _selectedView == 0,
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: _selectedView == 0 ? Colors.black : Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                    onSelected: (selected) {
                      if (selected) setState(() => _selectedView = 0);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ChoiceChip(
                    label: const Center(child: Text('Pending Approval View')),
                    selected: _selectedView == 1,
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: _selectedView == 1 ? Colors.black : Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                    onSelected: (selected) {
                      if (selected) setState(() => _selectedView = 1);
                    },
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: _selectedView == 0
                ? _buildApprovedDashboard()
                : _buildPendingApprovalView(),
          ),
        ],
      ),
    );
  }

  Widget _buildApprovedDashboard() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Business Header
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Flexible(
                          child: Text(
                            'Divine Floral & Stage Decor',
                            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.verified, color: Colors.greenAccent, size: 16),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text('Category: Wedding Decor • Mumbai, India', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Metrics Grid
        Row(
          children: [
            Expanded(child: _buildMetricTile('Active Leads', '4', Icons.mark_email_unread_outlined)),
            const SizedBox(width: 12),
            Expanded(child: _buildMetricTile('Bookings', '7', Icons.calendar_month_outlined)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _buildMetricTile('Gross Revenue', '₹14,20,000', Icons.currency_rupee_rounded)),
            const SizedBox(width: 12),
            Expanded(child: _buildMetricTile('Rating', '4.9 ★', Icons.star_outline_rounded)),
          ],
        ),
        const SizedBox(height: 24),

        // Customer Enquiries Leads
        const Text(
          'Incoming Customer Enquiries (Preview)',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildEnquiryCard(
          clientName: 'Rahul Sharma',
          eventType: 'Grand Sangeet Night',
          guestCount: '400 Guests',
          location: 'ITC Grand Bharat, Gurugram',
          budget: '₹3,50,000',
          date: '20 Nov 2026',
        ),
        const SizedBox(height: 12),
        _buildEnquiryCard(
          clientName: 'Pooja & Sameer',
          eventType: 'Floral Wedding Tunnel & Mandap',
          guestCount: '600 Guests',
          location: 'JW Marriott, Mumbai',
          budget: '₹5,00,000',
          date: '15 Dec 2026',
        ),
      ],
    );
  }

  Widget _buildMetricTile(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(height: 10),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildEnquiryCard({
    required String clientName,
    required String eventType,
    required String guestCount,
    required String location,
    required String budget,
    required String date,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(clientName, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('NEW LEAD', style: const TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('$eventType • $guestCount', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          Text('Location: $location', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Target Date: $date', style: const TextStyle(color: Colors.white70, fontSize: 12)),
              Text('Budget: $budget', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.redAccent),
                  ),
                  onPressed: () => _handleSimulatedAction('Decline Lead for $clientName'),
                  child: const Text('Decline', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                  ),
                  onPressed: () => _handleSimulatedAction('Accept Lead for $clientName'),
                  child: const Text('Accept Lead', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPendingApprovalView() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary.withValues(alpha: 0.1),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.4), width: 2),
            ),
            child: const Center(
              child: Icon(Icons.pending_actions_rounded, size: 40, color: AppColors.primary),
            ),
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Registration Pending Approval',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        const Text(
          'Welcome, Demo Vendor Partner. This preview simulates the exact interface new applicants see while awaiting administrator review.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),

        // Business Summary Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Submitted Profile Summary', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildDetailRow('Business Name', 'Royal Heritage Banquets & Decor'),
              _buildDetailRow('Contact Person', 'Vikramaditya Rathore'),
              _buildDetailRow('Email', 'partner@demoheritage.com'),
              _buildDetailRow('Status', 'Pending Verification', valueColor: AppColors.primary),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Progress Timeline
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text('Approval Progression', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              SizedBox(height: 14),
              _StepRow(icon: Icons.check_circle_rounded, color: Colors.greenAccent, title: '1. Profile Submitted', subtitle: 'Business details registered.'),
              SizedBox(height: 12),
              _StepRow(icon: Icons.hourglass_top_rounded, color: AppColors.primary, title: '2. Admin Approval', subtitle: 'Awaiting administrator verification in dashboard.'),
              SizedBox(height: 12),
              _StepRow(icon: Icons.lock_outline_rounded, color: AppColors.textSecondary, title: '3. Full Access Unlocked', subtitle: 'Receive customer leads and bookings.'),
            ],
          ),
        ),
        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            icon: const Icon(Icons.refresh_rounded, color: Colors.black),
            label: const Text('Check Approval Status (Simulated)', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => _handleSimulatedAction('Check Status'),
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          Text(value, style: TextStyle(color: valueColor ?? Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  const _StepRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            ],
          ),
        ),
      ],
    );
  }
}
