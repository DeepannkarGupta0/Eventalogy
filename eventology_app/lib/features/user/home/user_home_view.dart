import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../shell/user_shell_screen.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/responsive_web_container.dart';
import '../../../core/widgets/web_footer.dart';
import '../../../services/firestore/catalog_repository.dart';
import '../../../models/vendor_model.dart';
import '../../../models/venue_model.dart';
import '../events/widgets/create_event_sheet.dart';

class UserHomeView extends StatefulWidget {
  const UserHomeView({super.key});

  @override
  State<UserHomeView> createState() => _UserHomeViewState();
}

class _UserHomeViewState extends State<UserHomeView> {
  String _selectedEventType = 'Wedding';
  String _selectedCity = 'Raipur';
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 30));
  String _guestCount = '250+';
  String _selectedCategoryFilter = 'All';

  // Scale Estimator state
  double _calculatorGuests = 350;

  final List<String> _categoryFilters = [
    'All',
    'Heritage Palaces',
    'Open Lawns',
    'Convention Halls',
    'Sound & Stage',
    'Mandap & Decor',
    'Royal Catering',
  ];

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 960;

    return Scaffold(
      extendBodyBehindAppBar: !isDesktop,
      appBar: isDesktop
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'LOCATION',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.textSecondary,
                      letterSpacing: 1.2,
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(height: 2),
                  InkWell(
                    onTap: () => _showCityPicker(context),
                    borderRadius: BorderRadius.circular(8),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.location_on,
                          color: AppColors.primary,
                          size: 14,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$_selectedCity, India',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.keyboard_arrow_down,
                          color: AppColors.textSecondary,
                          size: 16,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              actions: [
                _buildAppBarActionIcon(Icons.search, () => context.push('/venues')),
                const SizedBox(width: 8),
                _buildAppBarActionIcon(Icons.notifications_none, () => _showNotifications(context)),
                const SizedBox(width: 16),
              ],
            ),
      body: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF070709),
          image: DecorationImage(
            image: NetworkImage('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1600&auto=format&fit=crop'),
            fit: BoxFit.cover,
            colorFilter: ColorFilter.mode(Color(0xF5070709), BlendMode.darken),
          ),
        ),
        child: SafeArea(
          bottom: false,
          top: !isDesktop,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              0,
              isDesktop ? 32.0 : 16.0,
              0,
              isDesktop ? 0 : 100.0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Web Content Wrapper ──────────────────────────────
                ResponsiveWebContainer(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Desktop Hero Section
                      if (isDesktop) ...[
                        _buildDesktopHeroHeader(),
                        const SizedBox(height: 32),
                      ],

                      // Universal Search Bar
                      _buildUniversalSearchBar(context),
                      const SizedBox(height: 16),

                      // Category Filter Pills
                      _buildCategoryFilterRow(),
                      const SizedBox(height: 32),

                      // Deep-Tech Engineering Primitives Showcase
                      if (isDesktop) ...[
                        _buildDeepTechShowcase(context),
                        const SizedBox(height: 48),
                      ],

                      // Production Studio Hero Card
                      _buildStudioHeroCard(context),
                      const SizedBox(height: 40),

                      // Featured Venues Section Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Featured Venues & Palaces',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'NBC 2016 safety-certified ballrooms, forts and open lawns with metric CAD models.',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: isDesktop ? 13 : 11,
                                ),
                              ),
                            ],
                          ),
                          TextButton(
                            onPressed: () => context.push('/venues'),
                            child: const Row(
                              children: [
                                Text(
                                  'Explore All Venues',
                                  style: TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.arrow_forward_rounded, color: AppColors.primary, size: 16),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Featured Venues (Responsive Grid or Carousel)
                      isDesktop
                          ? _buildDesktopFeaturedVenuesGrid()
                          : _buildFeaturedVenuesCarousel(),
                      const SizedBox(height: 40),

                      // Curated Event Formats
                      const Text(
                        'Curated Event Formats',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildQuickNavigateSection(context),
                      const SizedBox(height: 40),

                      // Verified Production Vendors Section Header
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Verified Production Crews',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '5-Tier KYC validated sound, lighting, trussing, and luxury catering contractors.',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: isDesktop ? 13 : 11,
                                ),
                              ),
                            ],
                          ),
                          TextButton(
                            onPressed: () => context.push('/vendors'),
                            child: const Row(
                              children: [
                                Text(
                                  'Explore All Crews',
                                  style: TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.arrow_forward_rounded, color: AppColors.primary, size: 16),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Verified Production Vendors (Responsive Grid or Column)
                      isDesktop
                          ? _buildDesktopVendorsGrid()
                          : _buildMobileVendorsColumn(),
                      const SizedBox(height: 48),

                      // Interactive Event Scale & Safety Estimator
                      _buildScaleEstimatorWidget(context, isDesktop),
                      const SizedBox(height: 48),
                    ],
                  ),
                ),

                // Web Footer
                if (isDesktop) const WebFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Desktop Hero Header ──────────────────────────────────────────────
  Widget _buildDesktopHeroHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0x14FFD700),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0x33FFD700)),
              ),
              child: const Text(
                'FLAGSHIP ENTERPRISE EVENT PLATFORM',
                style: TextStyle(
                  color: Color(0xFFFFD700),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0x1410B981),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0x3310B981)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.shield_outlined, color: Color(0xFF10B981), size: 13),
                  SizedBox(width: 4),
                  Text(
                    'NBC 2016 COMPLIANT',
                    style: TextStyle(
                      color: Color(0xFF10B981),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text(
          'The Deterministic Event Production\n& Engineering Platform',
          style: TextStyle(
            color: Colors.white,
            fontSize: 44,
            fontWeight: FontWeight.w900,
            height: 1.12,
            letterSpacing: -1.2,
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Institutional event architecture for high-stakes corporate galas, stadium concerts, and luxury weddings.\nEngineered with mathematical spatial solvers, NBC 2016 life safety proofs, and 25/50/25 milestone escrow.',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 16,
            height: 1.6,
          ),
        ),
      ],
    );
  }

  // ── Deep-Tech Engineering Primitives Showcase ────────────────────────
  Widget _buildDeepTechShowcase(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Core Engineering Primitives',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Zero conversational AI theater or speculative guesswork. Built strictly on proven mathematical and spatial algorithms.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _buildTechCard(
                icon: Icons.architecture_rounded,
                badge: 'OPENCV ENGINE',
                title: 'Blueprint Vectorizer',
                description: 'Transforms architectural 2D blueprint scans into millimeter-accurate Draw.io / CAD layers with wall & door detection.',
                onTap: () => _showBlueprintScanDialog(context),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildTechCard(
                icon: Icons.local_fire_department_rounded,
                badge: 'NBC 2016 PART 4',
                title: 'Life Safety Proofs',
                description: 'Verifies 30m maximum egress travel envelopes and 50 persons/unit width exit capacities to mathematically eliminate crush risk.',
                onTap: () => context.push('/venues'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildTechCard(
                icon: Icons.gavel_rounded,
                badge: '60s BLIND RFQ',
                title: 'Reverse-Auction Matrix',
                description: 'Automated reverse-auction matching. Vetted audio, trussing, and staging crews submit confidential line-item bids.',
                onTap: () => context.push('/vendors'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildTechCard(
                icon: Icons.account_balance_wallet_rounded,
                badge: 'ESCROW LEDGER',
                title: '25/50/25 Payouts',
                description: 'Double-entry escrow protection: 25% Advance on contract, 50% on loading dock QR signoff, 25% on final event strike.',
                onTap: () => context.push('/venues'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTechCard({
    required IconData icon,
    required String badge,
    required String title,
    required String description,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 210,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF10131D),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x1FFFFFFF)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(icon, color: AppColors.primary, size: 24),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: const Color(0x14FFD700),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        badge,
                        style: const TextStyle(
                          color: Color(0xFFFFD700),
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11.5,
                    height: 1.45,
                  ),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
            Row(
              children: [
                Text(
                  'Explore Specs',
                  style: TextStyle(
                    color: AppColors.primary.withOpacity(0.9),
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.arrow_forward_rounded, color: AppColors.primary.withOpacity(0.9), size: 12),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Universal Search Bar ─────────────────────────────────────────────
  Widget _buildUniversalSearchBar(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy');

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFF141824),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => _showSearchFilterDialog(context),
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded, color: AppColors.primary, size: 22),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$_selectedEventType in $_selectedCity, India',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${dateFormat.format(_selectedDate)} • $_guestCount guests • Verified Specs & Escrow',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Container(
            height: 38,
            width: 1,
            color: Colors.white.withValues(alpha: 0.1),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () => context.push('/venues'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.search, size: 18),
                SizedBox(width: 8),
                Text('Search Catalog', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Category Filter Pills ───────────────────────────────────────────
  Widget _buildCategoryFilterRow() {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _categoryFilters.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final filter = _categoryFilters[index];
          final isSelected = filter == _selectedCategoryFilter;

          return InkWell(
            onTap: () {
              setState(() {
                _selectedCategoryFilter = filter;
              });
            },
            borderRadius: BorderRadius.circular(20),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary
                    : const Color(0xFF141722),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected
                      ? AppColors.primary
                      : Colors.white.withValues(alpha: 0.1),
                ),
              ),
              child: Center(
                child: Text(
                  filter,
                  style: TextStyle(
                    color: isSelected ? Colors.black : Colors.white70,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Desktop Featured Venues Grid ─────────────────────────────────────
  Widget _buildDesktopFeaturedVenuesGrid() {
    return StreamBuilder<List<VenueModel>>(
      stream: CatalogRepository.streamFeaturedVenues(limit: 3),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final venues = snapshot.data ?? [];
        if (venues.isEmpty) {
          return Row(
            children: [
              Expanded(child: _buildVenueCardPlaceholder()),
              const SizedBox(width: 20),
              Expanded(child: _buildVenueCardPlaceholder()),
              const SizedBox(width: 20),
              Expanded(child: _buildVenueCardPlaceholder()),
            ],
          );
        }

        return Row(
          children: venues.map((v) {
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0),
                child: _buildVenueCard(context, v),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  // ── Mobile Featured Venues Carousel ──────────────────────────────────
  Widget _buildFeaturedVenuesCarousel() {
    return SizedBox(
      height: 230,
      child: StreamBuilder<List<VenueModel>>(
        stream: CatalogRepository.streamFeaturedVenues(limit: 4),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final venues = snapshot.data ?? [];
          if (venues.isEmpty) {
            return _buildVenueCardPlaceholder();
          }

          return ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: venues.length,
            separatorBuilder: (context, index) => const SizedBox(width: 14),
            itemBuilder: (context, index) {
              final venue = venues[index];
              return _buildVenueCard(context, venue);
            },
          );
        },
      ),
    );
  }

  Widget _buildVenueCard(BuildContext context, VenueModel venue) {
    final image = venue.images.isNotEmpty
        ? venue.images.first
        : 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=600&auto=format&fit=crop';

    return InkWell(
      onTap: () => context.push('/venues/${venue.venueId}'),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 230,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          image: DecorationImage(
            image: NetworkImage(image),
            fit: BoxFit.cover,
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.2),
                Colors.black.withValues(alpha: 0.88),
              ],
            ),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified, color: Colors.white, size: 10),
                        SizedBox(width: 4),
                        Text(
                          'NBC VERIFIED',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${venue.capacity} Pax',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    venue.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.location_on_outlined, color: AppColors.primary, size: 12),
                      const SizedBox(width: 4),
                      Text(
                        '$_selectedCity, India',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    venue.priceFrom != null
                        ? 'From ₹${NumberFormat('#,##,###').format(venue.priceFrom)} / day'
                        : 'Starting at ₹2,50,000 / day',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVenueCardPlaceholder() {
    return _buildVenueCard(
      context,
      VenueModel(
        venueId: 'v-demo-palace',
        name: 'The Grand Imperial Lawn & Palace',
        venueTypeId: 'palace',
        locationId: 'raipur',
        capacity: 650,
        priceFrom: 350000,
        priceTo: 500000,
        images: const [
          'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=600&auto=format&fit=crop',
        ],
        status: 'active',
        verified: true,
        createdAt: Timestamp.now(),
      ),
    );
  }

  // ── Desktop Vendors Grid ─────────────────────────────────────────────
  Widget _buildDesktopVendorsGrid() {
    return StreamBuilder<List<VendorModel>>(
      stream: CatalogRepository.streamFeaturedVendors(limit: 3),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final vendors = snapshot.data ?? [];
        if (vendors.isEmpty) {
          return _buildEmptyState('No production vendors found', Icons.storefront);
        }

        return Row(
          children: vendors.map((v) {
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0),
                child: _buildVendorCard(context, v),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  // ── Mobile Vendors Column ────────────────────────────────────────────
  Widget _buildMobileVendorsColumn() {
    return StreamBuilder<List<VendorModel>>(
      stream: CatalogRepository.streamFeaturedVendors(limit: 3),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final vendors = snapshot.data ?? [];
        if (vendors.isEmpty) {
          return _buildEmptyState('No production vendors found', Icons.storefront);
        }
        return Column(
          children: vendors.map((v) => _buildVendorCard(context, v)).toList(),
        );
      },
    );
  }

  // ── Production Studio Hero Card ─────────────────────────────────────
  Widget _buildStudioHeroCard(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 32),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF142421),
            Color(0xFF10131D),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.5),
            blurRadius: 40,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                  radius: 3,
                  backgroundColor: AppColors.primary,
                ),
                SizedBox(width: 8),
                Text(
                  'EVENT PRODUCTION STUDIO',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Design, Engineer &\nExecute Live Events',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
              height: 1.15,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Metric CAD blueprints, acoustic ray-tracing, NBC life-safety compliance, and multi-vendor reverse auctions.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => CreateEventSheet.show(context),
            icon: const Icon(Icons.rocket_launch_rounded, color: Colors.black, size: 18),
            label: const Text(
              '+ Launch Event Studio',
              style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
              elevation: 0,
            ),
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.center,
            children: [
              _buildStudioPill(
                icon: Icons.business_rounded,
                label: 'Venues',
                onTap: () => context.push('/venues'),
              ),
              _buildStudioPill(
                icon: Icons.storefront_rounded,
                label: 'Vendors',
                onTap: () => context.push('/vendors'),
              ),
              _buildStudioPill(
                icon: Icons.document_scanner_rounded,
                label: 'Blueprint Scan',
                onTap: () => _showBlueprintScanDialog(context),
              ),
              _buildStudioPill(
                icon: Icons.live_tv_rounded,
                label: 'Live Ops Deck',
                onTap: () => context.push('/operations/live-ros'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStudioPill({required IconData icon, required String label, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.primary, size: 14),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickNavigateSection(BuildContext context) {
    return SizedBox(
      height: 160,
      child: Row(
        children: [
          Expanded(
            child: Column(
              children: [
                Expanded(
                  child: _CategoryCard(
                    title: 'Weddings',
                    label: 'LUXURY',
                    imageUrl: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=500&auto=format&fit=crop',
                    onTap: () => context.push('/planner/details/et_wedding'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              children: [
                Expanded(
                  child: _CategoryCard(
                    title: 'Corporate',
                    label: 'OFFICIAL',
                    imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=500&auto=format&fit=crop',
                    onTap: () => UserShellScreen.of(context).changeTab(2),
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: _CategoryCard(
                    title: 'Birthdays',
                    label: 'CELEBRATION',
                    imageUrl: 'https://images.unsplash.com/photo-1530103862676-de3c9de59f9e?q=80&w=500&auto=format&fit=crop',
                    onTap: () => context.push('/planner/details/et_birthday'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Scale & Safety Estimator Widget ──────────────────────────────────
  Widget _buildScaleEstimatorWidget(BuildContext context, bool isDesktop) {
    final guests = _calculatorGuests.round();
    // NBC 2016 Part 4: 1.5 sq.m per occupant in banquet/assembly
    final reqSqMeters = (guests * 1.5).round();
    final reqSqFeet = (reqSqMeters * 10.764).round();
    // Exit door units: 1 unit width (0.5m) per 50 occupants
    final exitUnits = (guests / 50.0).ceil();
    final minExitWidthMeters = (exitUnits * 0.5).toStringAsFixed(1);
    // Audio estimate: ~10W RMS per guest for high fidelity
    final audioKW = (guests * 0.015).toStringAsFixed(1);

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(isDesktop ? 36 : 24),
      decoration: BoxDecoration(
        color: const Color(0xFF10131E),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x1FFFFFFF)),
      ),
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
                  'REAL-TIME LOGISTICS ESTIMATOR',
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
          const Text(
            'Instant Scale & NBC 2016 Fire Safety Proofs',
            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Slide guest count to calculate required floor area, aggregate exit widths, and audio rig wattage.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),

          // Slider
          Row(
            children: [
              Text(
                '$guests Guests',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              Expanded(
                child: Slider(
                  value: _calculatorGuests,
                  min: 50,
                  max: 2000,
                  divisions: 39,
                  activeColor: AppColors.primary,
                  inactiveColor: const Color(0xFF232A3B),
                  onChanged: (val) {
                    setState(() => _calculatorGuests = val);
                  },
                ),
              ),
              const Text(
                '2,000 max',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Metrics row
          isDesktop
              ? Row(
                  children: [
                    Expanded(child: _buildMetricTile('FLOOR AREA REQUIRED', '$reqSqFeet sq.ft ($reqSqMeters m²)', 'NBC 2016 Standard (1.5 m²/p)', Icons.space_dashboard)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildMetricTile('AGGREGATE EXIT WIDTH', '$minExitWidthMeters meters', '$exitUnits standard exit door units', Icons.door_front_door)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildMetricTile('PA SOUND POWER', '$audioKW kW RMS Rig', 'Linear acoustic coverage', Icons.speaker)),
                    const SizedBox(width: 16),
                    Expanded(child: _buildMetricTile('MILESTONE ESCROW', '25% • 50% • 25%', 'Double-entry lock mechanism', Icons.lock_outline)),
                  ],
                )
              : Column(
                  children: [
                    _buildMetricTile('FLOOR AREA REQUIRED', '$reqSqFeet sq.ft ($reqSqMeters m²)', 'NBC 2016 Standard (1.5 m²/p)', Icons.space_dashboard),
                    const SizedBox(height: 12),
                    _buildMetricTile('AGGREGATE EXIT WIDTH', '$minExitWidthMeters meters', '$exitUnits standard exit door units', Icons.door_front_door),
                    const SizedBox(height: 12),
                    _buildMetricTile('PA SOUND POWER', '$audioKW kW RMS Rig', 'Linear acoustic coverage', Icons.speaker),
                    const SizedBox(height: 12),
                    _buildMetricTile('MILESTONE ESCROW', '25% • 50% • 25%', 'Double-entry lock mechanism', Icons.lock_outline),
                  ],
                ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, String sub, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF141724),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 16),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            sub,
            style: TextStyle(color: AppColors.textSecondary.withOpacity(0.8), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildVendorCard(BuildContext context, VendorModel vendor) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF141724),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: InkWell(
        onTap: () => context.push('/vendors/${vendor.vendorId}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  color: AppColors.surfaceLighter,
                  image: vendor.portfolioImages != null && vendor.portfolioImages!.isNotEmpty
                      ? DecorationImage(
                          image: NetworkImage(vendor.portfolioImages!.first),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: vendor.portfolioImages == null || vendor.portfolioImages!.isEmpty
                    ? const Icon(Icons.storefront, color: AppColors.textSecondary)
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      vendor.businessName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontSize: 16,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      vendor.description ?? 'Premium Production Service',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _buildSmallTag(vendor.categoryIds.isNotEmpty
                            ? vendor.categoryIds.first.toUpperCase()
                            : 'PRODUCTION'),
                        const SizedBox(width: 6),
                        _buildSmallTag('KYC VERIFIED'),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.star, color: AppColors.primary, size: 12),
                    const SizedBox(width: 4),
                    Text(
                      vendor.rating?.toStringAsFixed(1) ?? '4.9',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSmallTag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: const TextStyle(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildEmptyState(String message, IconData icon) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: AppColors.textSecondary),
          const SizedBox(height: 16),
          Text(
            message,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBarActionIcon(IconData icon, VoidCallback onTap) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: IconButton(
        icon: Icon(icon, size: 20),
        color: AppColors.textSecondary,
        onPressed: onTap,
        constraints: const BoxConstraints.tightFor(width: 40, height: 40),
        padding: EdgeInsets.zero,
      ),
    );
  }

  void _showCityPicker(BuildContext context) {
    final cities = ['Raipur', 'Mumbai', 'Delhi NCR', 'Bengaluru', 'Jaipur'];
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFF141824),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Select Destination City',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ...cities.map(
              (city) => ListTile(
                title: Text(
                  city,
                  style: TextStyle(
                    color: _selectedCity == city ? AppColors.primary : Colors.white,
                    fontWeight: _selectedCity == city ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
                trailing: _selectedCity == city
                    ? const Icon(Icons.check, color: AppColors.primary)
                    : null,
                onTap: () {
                  setState(() => _selectedCity = city);
                  Navigator.pop(ctx);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSearchFilterDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Color(0xFF141824),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              border: Border(top: BorderSide(color: AppColors.glassBorder)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Universal Event Search',
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textSecondary),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text('Event Type', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  children: ['Wedding', 'Corporate', 'Concert', 'Birthday', 'Gala'].map((type) {
                    final sel = _selectedEventType == type;
                    return ChoiceChip(
                      label: Text(type),
                      selected: sel,
                      onSelected: (val) {
                        setState(() => _selectedEventType = type);
                        setModalState(() {});
                      },
                      selectedColor: AppColors.primary,
                      backgroundColor: const Color(0xFF1E2638),
                      labelStyle: TextStyle(
                        color: sel ? Colors.black : Colors.white,
                        fontWeight: sel ? FontWeight.bold : FontWeight.normal,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                const Text('Target Guests', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  children: ['50+', '150+', '250+', '500+', '1000+'].map((guests) {
                    final sel = _guestCount == guests;
                    return ChoiceChip(
                      label: Text(guests),
                      selected: sel,
                      onSelected: (val) {
                        setState(() => _guestCount = guests);
                        setModalState(() {});
                      },
                      selectedColor: AppColors.primary,
                      backgroundColor: const Color(0xFF1E2638),
                      labelStyle: TextStyle(
                        color: sel ? Colors.black : Colors.white,
                        fontWeight: sel ? FontWeight.bold : FontWeight.normal,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                const Text('Target Date', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                const SizedBox(height: 6),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (picked != null) {
                      setState(() => _selectedDate = picked);
                      setModalState(() {});
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E2638),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          DateFormat('dd MMMM yyyy').format(_selectedDate),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        const Icon(Icons.calendar_month, color: AppColors.primary, size: 18),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    context.push('/venues');
                  },
                  icon: const Icon(Icons.search, color: Colors.black),
                  label: const Text('Search Venues & Crews', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showBlueprintScanDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF18181D),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.glassBorder),
        ),
        title: const Row(
          children: [
            Icon(Icons.document_scanner_rounded, color: AppColors.primary, size: 24),
            SizedBox(width: 10),
            Text(
              'Blueprint Vector Scanner',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Upload an architectural floorplan or venue blueprint. Our computer vision model segments walls, exits, columns, and metric scale into a CAD-grade spatial model with NBC 2016 safety proofs.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: const Column(
                children: [
                  Icon(Icons.cloud_upload_outlined, color: AppColors.primary, size: 36),
                  SizedBox(height: 8),
                  Text(
                    'Select Blueprint Image / PDF',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Supports PNG, JPG, CAD export, or PDF (Max 25MB)',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 10),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              CreateEventSheet.show(context);
            },
            icon: const Icon(Icons.bolt, color: Colors.black, size: 16),
            label: const Text('Create Studio with Blueprint', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }

  void _showNotifications(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFF141418),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Recent Activity & Alerts',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_outline, color: AppColors.primary, size: 24),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome to Eventology India',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Your luxury celebration journey is active. Design, engineer, and execute with verified venues and production crews.',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  final String title;
  final String label;
  final String imageUrl;
  final VoidCallback onTap;

  const _CategoryCard({
    required this.title,
    required this.label,
    required this.imageUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          image: DecorationImage(
            image: NetworkImage(imageUrl),
            fit: BoxFit.cover,
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Colors.black.withValues(alpha: 0.8)],
            ),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 8,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
