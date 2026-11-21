import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../services/firestore/catalog_repository.dart';
import '../../../../models/venue_model.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/web_nav_bar.dart';
import '../../../../core/widgets/web_footer.dart';
import '../../../../core/widgets/responsive_web_container.dart';

class VenueListingScreen extends StatelessWidget {
  const VenueListingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 960;

    return Scaffold(
      appBar: isDesktop
          ? const WebNavBar(currentIndex: 0)
          : AppBar(
              title: const Text(
                'VENUES & PALACES',
                style: TextStyle(fontSize: 14, letterSpacing: 2, fontWeight: FontWeight.bold),
              ),
              centerTitle: true,
            ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Page Header Banner
            Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(
                vertical: isDesktop ? 48 : 24,
                horizontal: 24,
              ),
              decoration: const BoxDecoration(
                color: Color(0xFF0D0D11),
                border: Border(bottom: BorderSide(color: Color(0x1AFFFFFF))),
              ),
              child: ResponsiveWebContainer(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                          ),
                          child: const Text(
                            'NBC 2016 CERTIFIED SPACES',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Flagship Venues, Palaces & Arenas',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isDesktop ? 32 : 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Architectural venues with verified dimensions, structural load ratings, 3-phase power kVA, and municipal acoustic curfew limits.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: isDesktop ? 14 : 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Venue Catalog Grid
            Padding(
              padding: EdgeInsets.symmetric(vertical: isDesktop ? 40 : 20),
              child: ResponsiveWebContainer(
                child: StreamBuilder<List<VenueModel>>(
                  stream: CatalogRepository.streamActiveVenues(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Padding(
                        padding: EdgeInsets.all(60.0),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    if (snapshot.hasError) {
                      return Center(child: Text('Error: ${snapshot.error}'));
                    }
                    final venues = snapshot.data ?? [];
                    if (venues.isEmpty) {
                      return const Padding(
                        padding: EdgeInsets.all(60.0),
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.location_city, size: 64, color: AppColors.textSecondary),
                              SizedBox(height: 16),
                              Text('No venues available', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                              SizedBox(height: 8),
                              Text('Check back later or adjust your filters.', style: TextStyle(color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      );
                    }

                    return LayoutBuilder(
                      builder: (context, constraints) {
                        final crossAxisCount = constraints.maxWidth >= 1050
                            ? 3
                            : (constraints.maxWidth >= 650 ? 2 : 1);

                        return GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: crossAxisCount,
                            crossAxisSpacing: 24,
                            mainAxisSpacing: 24,
                            mainAxisExtent: 380,
                          ),
                          itemCount: venues.length,
                          itemBuilder: (context, index) {
                            final venue = venues[index];
                            return _buildVenueCard(context, venue);
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ),

            if (isDesktop) const WebFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildVenueCard(BuildContext context, VenueModel venue) {
    return Card(
      color: const Color(0xFF141722),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0x1FFFFFFF)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/venues/${venue.venueId}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image Thumbnail with Badges
            Stack(
              children: [
                Container(
                  height: 190,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLighter,
                    image: venue.images.isNotEmpty
                        ? DecorationImage(
                            image: NetworkImage(venue.images.first),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: venue.images.isEmpty
                      ? const Center(child: Icon(Icons.image, size: 48, color: AppColors.textSecondary))
                      : null,
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.75),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0x33FFFFFF)),
                    ),
                    child: Text(
                      '${venue.capacity} Pax',
                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                if (venue.verified)
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.verified, color: Colors.white, size: 10),
                          SizedBox(width: 4),
                          Text(
                            'NBC CERTIFIED',
                            style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),

            // Card Body
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          venue.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.location_on_outlined, size: 13, color: AppColors.primary),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                venue.locationId.toUpperCase(),
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    Column(
                      children: [
                        const Divider(color: Color(0x14FFFFFF), height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'ESTIMATED TARIFF',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 9.5, letterSpacing: 0.8),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  venue.priceFrom != null
                                      ? '₹${venue.priceFrom!.toStringAsFixed(0)} / day'
                                      : 'Custom Quote',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0x14FFD700),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0x33FFD700)),
                              ),
                              child: const Text(
                                'View CAD',
                                style: TextStyle(
                                  color: Color(0xFFFFD700),
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
