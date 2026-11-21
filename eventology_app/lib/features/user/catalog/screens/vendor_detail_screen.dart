import 'package:flutter/material.dart';
import '../../../../services/firestore/catalog_repository.dart';
import '../../../../models/vendor_model.dart';
import '../../../../core/theme/app_colors.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../../services/auth_state_notifier.dart';
import '../widgets/manual_enquiry_sheet.dart';
import 'package:go_router/go_router.dart';

class VendorDetailScreen extends StatefulWidget {
  final String vendorId;
  const VendorDetailScreen({super.key, required this.vendorId});

  @override
  State<VendorDetailScreen> createState() => _VendorDetailScreenState();
}

class _VendorDetailScreenState extends State<VendorDetailScreen> {
  int _selectedTabIndex = 0;

  void _handleEnquiry(BuildContext context, VendorModel vendor) async {
    final user = authStateNotifier.user ?? FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please sign in to send an enquiry.'),
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

    final success = await ManualEnquirySheet.show(context, vendor: vendor);
    if (success == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Enquiry sent to ${vendor.businessName}!'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<VendorModel?>(
      future: CatalogRepository.getVendor(widget.vendorId),
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
            body: Center(
              child: Text(
                'Error: ${snapshot.error}',
                style: const TextStyle(color: Colors.white),
              ),
            ),
          );
        }

        final vendor = snapshot.data;
        if (vendor == null) {
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
                    'Vendor Not Found',
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
                _buildHeroImage(context, vendor),
                _buildInteractiveTabBar(),
                Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: _buildActiveTabContent(vendor),
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
                      onPressed: () => _handleEnquiry(context, vendor),
                      icon: const Icon(Icons.request_quote_rounded, size: 20),
                      label: const Text(
                        'Request Custom Quote',
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
    final tabs = ['About', 'Services & Gear', 'Past Work', 'Verification'];
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

  Widget _buildActiveTabContent(VendorModel vendor) {
    switch (_selectedTabIndex) {
      case 0:
        return _buildAboutTab(vendor);
      case 1:
        return _buildServicesTab(vendor);
      case 2:
        return _buildPastWorkTab(vendor);
      case 3:
      default:
        return _buildVerificationTab(vendor);
    }
  }

  Widget _buildAboutTab(VendorModel vendor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Business Overview',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        const SizedBox(height: 12),
        Text(
          vendor.description ?? 'Certified high-capacity event production partner with verified logistics, crew, and technical equipment.',
          style: const TextStyle(color: AppColors.textSecondary, height: 1.6, fontSize: 14),
        ),
        const SizedBox(height: 24),
        const Text('Operational Highlights', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 12),
        _buildHighlightRow(Icons.check_circle_outline, 'ISO/NBC Compliant Rigging and Certified Electrical Distribution'),
        _buildHighlightRow(Icons.schedule, 'Punctual Load-In and On-Site Audio/Light Engineers Included'),
        _buildHighlightRow(Icons.security, 'Full Platform Escrow Protection with Milestone Release'),
      ],
    );
  }

  Widget _buildServicesTab(VendorModel vendor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Equipment & Capabilities', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 12),
        const Text(
          'Verified technical gear available for immediate deployment across festivals, concerts, and luxury weddings.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.5),
        ),
        const SizedBox(height: 16),
        _buildCapabilityCard('Live Sound Reinforcement', 'Dual 18" Subwoofers, Line Array Tops, Digital Mixing Console (32+ Channels)'),
        _buildCapabilityCard('Stage Lighting & Atmospheric SFX', 'Sharpy Moving Heads, LED Wash Pars, Haze Machines, DMX Controllers'),
        _buildCapabilityCard('Rigging & Structural Support', 'Heavy-Duty Aluminum Box Truss (IS 875 Wind-Load Certified)'),
      ],
    );
  }

  Widget _buildPastWorkTab(VendorModel vendor) {
    final images = vendor.portfolioImages ?? [];
    if (images.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Text('No portfolio images published yet.', style: TextStyle(color: AppColors.textSecondary)),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Production Portfolio', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
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

  Widget _buildVerificationTab(VendorModel vendor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Verification & Escrow Ledger', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 20),
                  SizedBox(width: 8),
                  Text('Eventology Verified Merchant', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
              SizedBox(height: 8),
              Text(
                'GST Registration, PAN identity, commercial warehouse, and bank disbursement accounts have been vetted.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildHighlightRow(Icons.lock_outline, 'Payment is held in secure platform escrow until post-event sign-off.'),
        _buildHighlightRow(Icons.assignment_return_outlined, 'Standard 100% refund on cancellations > 30 days prior to load-in.'),
      ],
    );
  }

  Widget _buildHighlightRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: const TextStyle(color: Colors.white70, fontSize: 13, height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _buildCapabilityCard(String title, String desc) {
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
          Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 4),
          Text(desc, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.4)),
        ],
      ),
    );
  }

  Widget _buildHeroImage(BuildContext context, VendorModel vendor) {
    final hasImages = vendor.portfolioImages != null && vendor.portfolioImages!.isNotEmpty;
    final bgImage = hasImages
        ? vendor.portfolioImages!.first
        : 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1000&auto=format&fit=crop';

    return SizedBox(
      height: 480,
      child: Stack(
        children: [
          Container(
            width: double.infinity,
            height: 480,
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
                  Colors.black.withValues(alpha: 0.3),
                  Colors.black.withValues(alpha: 0.6),
                  const Color(0xFF0D0D0F),
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        vendor.businessName,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                    if (vendor.verified) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.verified, color: AppColors.primary, size: 24),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildMetric(Icons.star, '${vendor.rating?.toStringAsFixed(1) ?? '4.9'} Rating'),
                    const SizedBox(width: 16),
                    _buildMetric(Icons.event_available, '120+ Gigs Done'),
                  ],
                ),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12.0),
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
          ),
        ],
      ),
    );
  }

  Widget _buildMetric(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.primary, size: 13),
          const SizedBox(width: 5),
          Text(
            text,
            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
