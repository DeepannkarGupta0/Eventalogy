import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_colors.dart';
import 'responsive_web_container.dart';

class WebFooter extends StatelessWidget {
  const WebFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 900;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Color(0xFF040507),
        border: Border(
          top: BorderSide(color: Color(0x1AFFFFFF), width: 1),
        ),
      ),
      padding: EdgeInsets.symmetric(
        vertical: isDesktop ? 64 : 40,
      ),
      child: ResponsiveWebContainer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (isDesktop)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: _buildBrandColumn(context)),
                  const SizedBox(width: 48),
                  Expanded(flex: 2, child: _buildPlatformColumn(context)),
                  const SizedBox(width: 32),
                  Expanded(flex: 2, child: _buildCatalogsColumn(context)),
                  const SizedBox(width: 32),
                  Expanded(flex: 2, child: _buildTrustColumn(context)),
                ],
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildBrandColumn(context),
                  const SizedBox(height: 36),
                  _buildPlatformColumn(context),
                  const SizedBox(height: 36),
                  _buildCatalogsColumn(context),
                  const SizedBox(height: 36),
                  _buildTrustColumn(context),
                ],
              ),

            const SizedBox(height: 48),
            const Divider(color: Color(0x14FFFFFF), height: 1),
            const SizedBox(height: 24),

            // Bottom bar
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    '© 2026 Eventology Technology Solutions Pvt. Ltd. All rights reserved.',
                    style: TextStyle(
                      color: AppColors.textSecondary.withOpacity(0.7),
                      fontSize: 12,
                    ),
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0x1410B981),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0x3310B981)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.verified_user, color: Color(0xFF10B981), size: 12),
                          SizedBox(width: 4),
                          Text(
                            'NBC 2016 VERIFIED',
                            style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0x14FFD700),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0x33FFD700)),
                      ),
                      child: const Text(
                        'ESCROW PROTECTED',
                        style: TextStyle(color: Color(0xFFFFD700), fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrandColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFD700), Color(0xFFB8860B)],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.apartment_rounded, color: Colors.black, size: 18),
            ),
            const SizedBox(width: 10),
            const Text(
              'EVENTOLOGY',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          'The deterministic event engineering and production marketplace. Built on mathematical spatial solvers, NBC 2016 life safety proofs, and institutional 25/50/25 milestone escrow.',
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
            height: 1.6,
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: const Text(
            'CIN: U72900CT2026PTC018920 • GSTIN: 22AABCE1234F1Z8',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 10.5, fontFamily: 'monospace'),
          ),
        ),
      ],
    );
  }

  Widget _buildPlatformColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'PLATFORM & TECH',
          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.5),
        ),
        const SizedBox(height: 16),
        _buildFooterLink('OpenCV Metric Blueprint Vectorizer', () => context.push('/venues')),
        _buildFooterLink('NBC 2016 Life-Safety Proofs', () => context.push('/venues')),
        _buildFooterLink('SAT 2D Spatial Polygon Engine', () => context.push('/venues')),
        _buildFooterLink('Reverse-Auction Procurement', () => context.push('/vendors')),
        _buildFooterLink('25/50/25 Milestone Escrow', () => context.push('/venues')),
      ],
    );
  }

  Widget _buildCatalogsColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'CATALOGS & CITIES',
          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.5),
        ),
        const SizedBox(height: 16),
        _buildFooterLink('Heritage Palaces & Forts', () => context.push('/venues')),
        _buildFooterLink('Open Lawns & Resorts', () => context.push('/venues')),
        _buildFooterLink('Sound & Concert Line Arrays', () => context.push('/vendors')),
        _buildFooterLink('Intelligent Moving Heads & Truss', () => context.push('/vendors')),
        _buildFooterLink('Raipur • Bilaspur • Bhilai • Delhi', () => context.push('/venues')),
      ],
    );
  }

  Widget _buildTrustColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'TRUST & OPERATIONS',
          style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.5),
        ),
        const SizedBox(height: 16),
        _buildFooterLink('Become a Certified Vendor', () => context.push('/become-vendor')),
        _buildFooterLink('24/7 Field Dispatch: +91 771 400 9000', null),
        _buildFooterLink('Dock QR Signoff Verification', () => context.push('/venues')),
        _buildFooterLink('Privacy Policy & Terms of Service', null),
        _buildFooterLink('Escrow Dispute Resolution', null),
      ],
    );
  }

  Widget _buildFooterLink(String label, VoidCallback? onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        child: Text(
          label,
          style: TextStyle(
            color: onTap != null ? AppColors.textSecondary : AppColors.textSecondary.withOpacity(0.6),
            fontSize: 13,
            decoration: TextDecoration.none,
          ),
        ),
      ),
    );
  }
}
