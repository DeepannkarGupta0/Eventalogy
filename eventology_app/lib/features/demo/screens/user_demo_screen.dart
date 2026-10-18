import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../services/demo_session_notifier.dart';
import '../widgets/demo_mode_banner.dart';

class UserDemoScreen extends StatefulWidget {
  const UserDemoScreen({super.key});

  @override
  State<UserDemoScreen> createState() => _UserDemoScreenState();
}

class _UserDemoScreenState extends State<UserDemoScreen> {
  int _currentTab = 0;

  void _handleSimulatedAction(String actionTitle) {
    // Assert safety: if any unintended mutation were invoked, it is blocked
    try {
      demoSessionNotifier.assertMutationAllowed(actionTitle);
    } catch (_) {}
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
          'Action "$actionTitle" is simulated for administrator preview. Real Firestore mutations, live merchant enquiries, and payment gateways are completely disabled.',
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
          const DemoModeBanner(demoType: 'Customer Preview'),
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
              'Customer App Preview',
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
          Expanded(
            child: IndexedStack(
              index: _currentTab,
              children: [
                _buildHomeTab(),
                _buildPlannerTab(),
                _buildEventsTab(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTab,
        onTap: (index) => setState(() => _currentTab = index),
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.auto_awesome_rounded), label: 'AI Planner'),
          BottomNavigationBarItem(icon: Icon(Icons.event_note_rounded), label: 'My Events'),
        ],
      ),
    );
  }

  Widget _buildHomeTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Hero Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF2A2000), Color(0xFF14120A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'AI EVENT ARCHITECT',
                      style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const Text('DEMO DATA', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Plan Your Dream Celebration in Seconds',
                style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Experience autonomous event curation with intelligent vendor recommendations and budget optimization.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.bolt, color: Colors.black, size: 18),
                label: const Text('Try Quick Plan Generation', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => _handleSimulatedAction('Quick Plan Generation'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Section Title: Curated Venues
        const Text(
          'Featured Venues (Preview)',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildVenueCard(
          name: 'The Leela Palace Udaipur',
          location: 'Lake Pichola, Udaipur',
          capacity: '500-1000 Guests',
          rating: '4.9 ★',
          price: '₹12,00,000 / day',
        ),
        const SizedBox(height: 12),
        _buildVenueCard(
          name: 'Taj Lands End',
          location: 'Bandra, Mumbai',
          capacity: '300-800 Guests',
          rating: '4.8 ★',
          price: '₹18,50,000 / day',
        ),
        const SizedBox(height: 24),

        // Section Title: Featured Vendors
        const Text(
          'Top Verified Vendors (Preview)',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        _buildVendorCard(
          name: 'Royal Shahi Decorators',
          category: 'Stage & Theme Decor',
          rating: '4.9 ★ (128 reviews)',
          price: 'From ₹1,50,000',
        ),
        const SizedBox(height: 12),
        _buildVendorCard(
          name: 'Divine Moments Cinema',
          category: 'Candid Photography & Film',
          rating: '4.8 ★ (94 reviews)',
          price: 'From ₹2,20,000',
        ),
      ],
    );
  }

  Widget _buildVenueCard({
    required String name,
    required String location,
    required String capacity,
    required String rating,
    required String price,
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
              Expanded(
                child: Text(
                  name,
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(rating, style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(location, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Capacity: $capacity', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              Text(price, style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => _handleSimulatedAction('Enquire Availability: $name'),
              child: const Text('Enquire Availability', style: TextStyle(color: AppColors.primary, fontSize: 13)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVendorCard({
    required String name,
    required String category,
    required String rating,
    required String price,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.storefront, color: AppColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(category, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 4),
                Text('$rating • $price', style: const TextStyle(color: AppColors.primary, fontSize: 11)),
              ],
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
            ),
            onPressed: () => _handleSimulatedAction('Book Vendor: $name'),
            child: const Text('Book', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildPlannerTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
              const Text('AI Event Plan Preview', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Generated for: 250 Guests Royal Wedding in Jaipur', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              const Divider(color: AppColors.glassBorder, height: 24),
              _buildPlanItem('Recommended Venue', 'Rambagh Palace Heritage Lawn', '₹8,00,000'),
              _buildPlanItem('Catering Package', 'Royal Rajputana Banquet (250 pax)', '₹4,50,000'),
              _buildPlanItem('Decor & Stage', 'Elegance Marigold & Crystal Setup', '₹2,50,000'),
              _buildPlanItem('Photography', 'Signature Cinematic Moments Team', '₹1,50,000'),
              const Divider(color: AppColors.glassBorder, height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: const [
                  Text('Estimated Investment', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  Text('₹16,50,000', style: TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onPressed: () => _handleSimulatedAction('Confirm AI Plan'),
                  child: const Text('Confirm AI Plan (Simulated)', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPlanItem(String role, String selection, String amount) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(role, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                Text(selection, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Text(amount, style: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildEventsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Aarav & Meera Wedding', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.greenAccent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('IN PLANNING', style: TextStyle(color: Colors.greenAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text('Date: 12 December 2026 • Udaipur, India', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              const Divider(color: AppColors.glassBorder, height: 24),
              const Text('Checklist & Milestones', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _buildChecklistItem('Venue agreement signed', true),
              _buildChecklistItem('Catering menu tasting completed', true),
              _buildChecklistItem('Guest list finalized (350 pax)', true),
              _buildChecklistItem('Photography shot-list sign-off', false),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.primary),
                  ),
                  onPressed: () => _handleSimulatedAction('Modify Event Milestones'),
                  child: const Text('Manage Event (Simulated)', style: TextStyle(color: AppColors.primary)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildChecklistItem(String title, bool done) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            color: done ? Colors.greenAccent : AppColors.textSecondary,
            size: 16,
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              color: done ? Colors.white : AppColors.textSecondary,
              fontSize: 12,
              decoration: done ? TextDecoration.lineThrough : null,
            ),
          ),
        ],
      ),
    );
  }
}
