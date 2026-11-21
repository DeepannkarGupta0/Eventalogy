import 'package:flutter/material.dart';
import '../../../../services/firestore/catalog_repository.dart';
import '../../../../models/venue_model.dart';
import '../../../../core/theme/app_colors.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../../services/auth_state_notifier.dart';
import '../widgets/manual_enquiry_sheet.dart';
import 'package:go_router/go_router.dart';

class VenueDetailScreen extends StatefulWidget {
  final String venueId;
  const VenueDetailScreen({super.key, required this.venueId});

  @override
  State<VenueDetailScreen> createState() => _VenueDetailScreenState();
}

class _VenueDetailScreenState extends State<VenueDetailScreen> {
  int _selectedTabIndex = 0;

  void _handleEnquiry(BuildContext context, VenueModel venue) async {
    final user = authStateNotifier.user ?? FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please sign in to enquire about venue availability.'),
          backgroundColor: AppColors.surfaceHighlight,
          action: SnackBarAction(
            label: 'Sign In',
            textColor: AppColors.primary,
            onPressed: () => context.push('/login'),
          ),
        ),
      );
      return;
    }

    final success = await ManualEnquirySheet.show(context, venue: venue);
    if (success == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Availability enquiry sent for ${venue.name}!'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<VenueModel?>(
      future: CatalogRepository.getVenue(widget.venueId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFF0D0D0F),
            body: Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          );
        }
        if (snapshot.hasError) {
          return Scaffold(
            backgroundColor: const Color(0xFF0D0D0F),
            body: Center(child: Text('Error: ${snapshot.error}')),
          );
        }

        final venue = snapshot.data;
        if (venue == null) {
          return Scaffold(
            backgroundColor: const Color(0xFF0D0D0F),
            appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
            body: const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 64, color: AppColors.error),
                  SizedBox(height: 16),
                  Text(
                    'Venue Not Found',
                    style: TextStyle(color: Colors.white, fontSize: 18),
                  ),
                ],
              ),
            ),
          );
        }

        return Scaffold(
          backgroundColor: const Color(0xFF0D0D0F),
          body: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeroImage(context, venue),
                _buildInteractiveTabBar(),
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: _buildActiveTabContent(venue),
                ),
                const SizedBox(height: 100),
              ],
            ),
          ),
          bottomNavigationBar: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFF121622),
              border: const Border(
                top: BorderSide(color: AppColors.glassBorder),
              ),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _handleEnquiry(context, venue),
                      icon: const Icon(Icons.calendar_month_rounded, size: 20),
                      label: const Text(
                        'Enquire Date Availability & Quote',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildInteractiveTabBar() {
    final tabs = ['The Venue', 'Spaces & Lawns', 'Pricing & Policy', 'Gallery'];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(tabs.length, (idx) {
          final isActive = _selectedTabIndex == idx;
          return GestureDetector(
            onTap: () => setState(() => _selectedTabIndex = idx),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                border: isActive
                    ? const Border(bottom: BorderSide(color: AppColors.primary, width: 2.5))
                    : null,
              ),
              child: Text(
                tabs[idx],
                style: TextStyle(
                  color: isActive ? Colors.white : AppColors.textSecondary,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                  fontSize: 13,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildActiveTabContent(VenueModel venue) {
    switch (_selectedTabIndex) {
      case 0:
        return _buildVenueOverviewTab(venue);
      case 1:
        return _buildSpacesTab(venue);
      case 2:
        return _buildPricingTab(venue);
      case 3:
      default:
        return _buildGalleryTab(venue);
    }
  }

  Widget _buildVenueOverviewTab(VenueModel venue) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildStatColumn(Icons.group, '${venue.capacity}', 'Max Capacity'),
            _buildStatColumn(Icons.star, '4.9', 'Rating'),
            if (venue.priceFrom != null)
              _buildStatColumn(Icons.currency_rupee, '${(venue.priceFrom! / 100000).toStringAsFixed(1)}L', 'Starting Price'),
          ],
        ),
        const SizedBox(height: 28),
        const Text(
          'Venue Story & Atmosphere',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 12),
        Text(
          venue.description ?? 'An exclusive luxury venue designed to host the most magnificent celebrations with grand architectural backdrops.',
          style: const TextStyle(color: AppColors.textSecondary, height: 1.6, fontSize: 14),
        ),
        const SizedBox(height: 24),
        if (venue.amenities.isNotEmpty) ...[
          const Text('Curated Services & Amenities', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: venue.amenities.map((a) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Text(a, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildSpacesTab(VenueModel venue) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Experience Spaces & Lawns', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 8),
        const Text(
          'Breakdown of individual halls and open lawn areas available for staging, ceremonies, and dining.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 20),
        _buildExperienceAreasGrid(),
      ],
    );
  }

  Widget _buildPricingTab(VenueModel venue) {
    final startPrice = venue.priceFrom != null ? '₹${(venue.priceFrom! / 100000).toStringAsFixed(1)} Lakhs' : 'On Request';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Transparent Pricing & Policies', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 14),
        _buildPricingRow('Base Venue Rental', startPrice, 'Includes 24-hour venue access, green rooms, and basic power'),
        _buildPricingRow('Dining / Per Plate Rate', '₹2,500 - ₹4,000 / guest', 'Varies by chosen catering package (Royal Marwari / Pan-Asian)'),
        _buildPricingRow('Municipal Noise Curfew', '10:00 PM (Strict)', 'Open lawns must transition amplified sound indoors by 10 PM'),
        _buildPricingRow('Platform Escrow Guarantee', '100% Protected', 'Security deposit held in escrow until load-out inspection'),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          ),
          child: const Row(
            children: [
              Icon(Icons.shield_outlined, color: AppColors.primary, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Cancellation: 100% refund for cancellations > 60 days before event date.',
                  style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGalleryTab(VenueModel venue) {
    final images = venue.images;
    if (images.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Text('No gallery images available.', style: TextStyle(color: AppColors.textSecondary)),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Venue Architecture Gallery', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
            Text('${images.length} Photos', style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: images.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.2,
          ),
          itemBuilder: (context, idx) {
            return ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(images[idx], fit: BoxFit.cover),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPricingRow(String title, String cost, String subtitle) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
              Text(cost, style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.4)),
        ],
      ),
    );
  }

  Widget _buildStatColumn(IconData icon, String value, String label) {
    return Column(
      children: [
        Icon(icon, color: AppColors.primary, size: 26),
        const SizedBox(height: 6),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildHeroImage(BuildContext context, VenueModel venue) {
    final bgImage = venue.images.isNotEmpty
        ? venue.images.first
        : 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1000&auto=format&fit=crop';

    return SizedBox(
      height: 460,
      child: Stack(
        children: [
          Container(
            width: double.infinity,
            height: 460,
            decoration: BoxDecoration(
              image: DecorationImage(
                image: NetworkImage(bgImage),
                fit: BoxFit.cover,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.4),
                  Colors.black.withValues(alpha: 0.7),
                  const Color(0xFF0D0D0F),
                ],
                stops: const [0.0, 0.6, 1.0],
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16,
            child: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24),
                ),
                child: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          Positioned(
            bottom: 24,
            left: 20,
            right: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary, width: 2.5),
                    image: DecorationImage(
                      image: NetworkImage(bgImage),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  venue.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                if (venue.verified) ...[
                  const SizedBox(height: 6),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.verified, color: AppColors.primary, size: 18),
                      SizedBox(width: 6),
                      Text(
                        'Eventology Verified Venue',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.location_on, color: AppColors.textSecondary, size: 14),
                    SizedBox(width: 4),
                    Text(
                      'Raipur, India',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExperienceAreasGrid() {
    final areas = [
      {'name': 'Grand Ballroom', 'icon': Icons.business, 'capacity': '800 Pax'},
      {'name': 'Poolside Terrace', 'icon': Icons.pool, 'capacity': '200 Pax'},
      {'name': 'Royal Lawns', 'icon': Icons.park, 'capacity': '1500 Pax'},
      {'name': 'Banquet Dining Hall', 'icon': Icons.restaurant, 'capacity': '400 Pax'},
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.15,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: areas.length,
      itemBuilder: (context, index) {
        final area = areas[index];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(area['icon'] as IconData, color: AppColors.primary, size: 28),
              const Spacer(),
              Text(
                area['name'] as String,
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                area['capacity'] as String,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
              ),
            ],
          ),
        );
      },
    );
  }
}
