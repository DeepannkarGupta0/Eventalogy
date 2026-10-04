import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../services/firestore/catalog_repository.dart';
import '../../../../models/venue_model.dart';
import '../../../../core/theme/app_colors.dart';

class VenueDetailScreen extends StatelessWidget {
  final String venueId;
  const VenueDetailScreen({super.key, required this.venueId});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<VenueModel?>(
      future: CatalogRepository.getVenue(venueId),
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
                _buildFakeTabBar(),
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _buildStatColumn(
                            Icons.group,
                            '${venue.capacity}',
                            'Max Capacity',
                          ),
                          _buildStatColumn(
                            Icons.star,
                            '4.9',
                            'Rating',
                          ), // Mock rating
                          if (venue.priceFrom != null)
                            _buildStatColumn(
                              Icons.currency_rupee,
                              '${(venue.priceFrom! / 100000).toStringAsFixed(1)}L',
                              'Starting Price',
                            ),
                        ],
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'The Narrative',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        venue.description ?? 'An exclusive luxury venue designed to host the most magnificent celebrations.',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          height: 1.6,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'Experience Areas',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildExperienceAreasGrid(),
                      const SizedBox(height: 32),
                      if (venue.amenities.isNotEmpty) ...[
                        const Text(
                          'Curated Services',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: venue.amenities
                              .map(
                                (a) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: AppColors.glassBorder,
                                    ),
                                  ),
                                  child: Text(
                                    a,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 100), // padding for bottom bar
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          bottomNavigationBar: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surface.withOpacity(0.95),
              border: const Border(
                top: BorderSide(color: AppColors.glassBorder),
              ),
            ),
            child: ElevatedButton(
              onPressed: () => context.push('/ai-planner'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Add Venue to Plan',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatColumn(IconData icon, String value, String label) {
    return Column(
      children: [
        Icon(icon, color: AppColors.primary, size: 28),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildHeroImage(BuildContext context, VenueModel venue) {
    final bgImage = venue.images.isNotEmpty
        ? venue.images.first
        : 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1000&auto=format&fit=crop';

    return SizedBox(
      height: 520,
      child: Stack(
        children: [
          // Background Image
          Container(
            width: double.infinity,
            height: 520,
            decoration: BoxDecoration(
              image: DecorationImage(
                image: NetworkImage(bgImage),
                fit: BoxFit.cover,
              ),
            ),
          ),
          // Dark gradient overlay
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withOpacity(0.4),
                  Colors.black.withOpacity(0.7),
                  const Color(0xFF0D0D0F),
                ],
                stops: const [0.0, 0.6, 1.0],
              ),
            ),
          ),
          // Back Button
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 16,
            child: IconButton(
              icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          // Content
          Positioned(
            bottom: 32,
            left: 24,
            right: 24,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary, width: 3),
                    image: DecorationImage(
                      image: NetworkImage(bgImage),
                      fit: BoxFit.cover,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.4),
                        blurRadius: 30,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  venue.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                if (venue.verified) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.verified,
                        color: AppColors.primary,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Eventology Verified Venue',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.location_on,
                      color: AppColors.textSecondary,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      'Raipur, India',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
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

  Widget _buildFakeTabBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildTabItem('The Venue', isActive: true),
          _buildTabItem('Spaces', isActive: false),
          _buildTabItem('Reviews', isActive: false),
        ],
      ),
    );
  }

  Widget _buildTabItem(String text, {required bool isActive}) {
    return Container(
      padding: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        border: isActive
            ? const Border(
                bottom: BorderSide(color: AppColors.primary, width: 2),
              )
            : null,
      ),
      child: Text(
        text,
        style: TextStyle(
          color: isActive ? Colors.white : AppColors.textSecondary,
          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
        ),
      ),
    );
  }

  Widget _buildExperienceAreasGrid() {
    final areas = [
      {'name': 'Grand Ballroom', 'icon': Icons.business, 'capacity': '800 Pax'},
      {'name': 'Poolside', 'icon': Icons.pool, 'capacity': '200 Pax'},
      {'name': 'Lush Lawns', 'icon': Icons.park, 'capacity': '1500 Pax'},
      {'name': 'Banquet Hall', 'icon': Icons.restaurant, 'capacity': '400 Pax'},
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.1,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
      ),
      itemCount: areas.length,
      itemBuilder: (context, index) {
        final area = areas[index];
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                area['icon'] as IconData,
                color: AppColors.primary,
                size: 32,
              ),
              const Spacer(),
              Text(
                area['name'] as String,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                area['capacity'] as String,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
