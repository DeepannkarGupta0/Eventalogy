import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../services/firestore/catalog_repository.dart';
import '../../../../models/vendor_model.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/web_nav_bar.dart';
import '../../../../core/widgets/web_footer.dart';
import '../../../../core/widgets/responsive_web_container.dart';

class VendorListingScreen extends StatelessWidget {
  final String? categoryId;
  const VendorListingScreen({super.key, this.categoryId});

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 960;

    return Scaffold(
      appBar: isDesktop
          ? const WebNavBar(currentIndex: 1)
          : AppBar(
              title: const Text(
                'PRODUCTION CREWS',
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
                            color: const Color(0x1410B981),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0x3310B981)),
                          ),
                          child: const Text(
                            '5-TIER KYC VERIFIED CREWS',
                            style: TextStyle(
                              color: Color(0xFF10B981),
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
                      'Technical Production Vendors & Gear',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isDesktop ? 32 : 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Line-array sound rigs, structural lighting trusses, silent diesel generators, and FSSAI certified luxury catering fleets.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: isDesktop ? 14 : 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Vendor Catalog Grid
            Padding(
              padding: EdgeInsets.symmetric(vertical: isDesktop ? 40 : 20),
              child: ResponsiveWebContainer(
                child: categoryId == null
                    ? _buildAllVendorsStream(isDesktop)
                    : _buildCategoryVendorsStream(isDesktop),
              ),
            ),

            if (isDesktop) const WebFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildAllVendorsStream(bool isDesktop) {
    return StreamBuilder<List<VendorModel>>(
      stream: CatalogRepository.streamFeaturedVendors(limit: 50),
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
        final vendors = snapshot.data ?? [];
        return _buildVendorResponsiveGrid(context, vendors);
      },
    );
  }

  Widget _buildCategoryVendorsStream(bool isDesktop) {
    return StreamBuilder<List<VendorModel>>(
      stream: CatalogRepository.streamVendorsByCategory(categoryId!),
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
        final vendors = snapshot.data ?? [];
        return _buildVendorResponsiveGrid(context, vendors);
      },
    );
  }

  Widget _buildVendorResponsiveGrid(BuildContext context, List<VendorModel> vendors) {
    if (vendors.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(60.0),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.search_off, size: 64, color: AppColors.textSecondary),
              SizedBox(height: 16),
              Text('No production crews found', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text('Try exploring a different category or refining your search filters.', style: TextStyle(color: AppColors.textSecondary)),
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
            mainAxisExtent: 330,
          ),
          itemCount: vendors.length,
          itemBuilder: (context, index) {
            final vendor = vendors[index];
            return _buildVendorCard(context, vendor);
          },
        );
      },
    );
  }

  Widget _buildVendorCard(BuildContext context, VendorModel vendor) {
    final image = (vendor.portfolioImages != null && vendor.portfolioImages!.isNotEmpty)
        ? vendor.portfolioImages!.first
        : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop';

    return Card(
      color: const Color(0xFF141722),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0x1FFFFFFF)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/vendors/${vendor.vendorId}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Image
            Stack(
              children: [
                Container(
                  height: 160,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLighter,
                    image: DecorationImage(
                      image: NetworkImage(image),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified, color: Colors.white, size: 10),
                        SizedBox(width: 4),
                        Text(
                          'KYC TIER 5 VERIFIED',
                          style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                if (vendor.rating != null)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.75),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.star, color: AppColors.primary, size: 11),
                          const SizedBox(width: 3),
                          Text(
                            vendor.rating!.toStringAsFixed(1),
                            style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),

            // Info
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
                          vendor.businessName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0x14FFD700),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            vendor.categoryIds.isNotEmpty
                                ? vendor.categoryIds.first.toUpperCase()
                                : 'PRODUCTION',
                            style: const TextStyle(color: Color(0xFFFFD700), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
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
                                  'STARTING AT',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 9.5, letterSpacing: 0.8),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  vendor.baseDayRatePaise != null
                                      ? '₹${(vendor.baseDayRatePaise! / 100).toStringAsFixed(0)}'
                                      : 'Line-Item RFQ',
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
                                color: const Color(0x1AFFFFFF),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Request Quote',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
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
