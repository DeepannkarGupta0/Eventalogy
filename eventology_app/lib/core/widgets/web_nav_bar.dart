import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_colors.dart';
import '../../services/auth_state_notifier.dart';
import '../../features/user/events/widgets/create_event_sheet.dart';

class WebNavBar extends StatelessWidget implements PreferredSizeWidget {
  final int currentIndex;
  final ValueChanged<int>? onTabSelected;

  const WebNavBar({
    super.key,
    this.currentIndex = 0,
    this.onTabSelected,
  });

  @override
  Size get preferredSize => const Size.fromHeight(74);

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = authStateNotifier.isAuthenticated;
    final role = authStateNotifier.role;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          height: 74,
          padding: const EdgeInsets.symmetric(horizontal: 32),
          decoration: BoxDecoration(
            color: const Color(0xFF070709).withOpacity(0.92),
            border: const Border(
              bottom: BorderSide(color: Color(0x1AFFFFFF), width: 1),
            ),
          ),
          child: Row(
            children: [
              // ── 1. Brand Logo & Title ──────────────────────────────
              InkWell(
                onTap: () {
                  if (onTabSelected != null) {
                    onTabSelected!(0);
                  } else {
                    context.go('/home');
                  }
                },
                borderRadius: BorderRadius.circular(8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFD700), Color(0xFFB8860B)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFFD700).withOpacity(0.3),
                            blurRadius: 10,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.apartment_rounded,
                          color: Colors.black,
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'EVENTOLOGY',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2.5,
                          ),
                        ),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFD700).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.4), width: 0.8),
                              ),
                              child: const Text(
                                'FLAGSHIP STUDIO',
                                style: TextStyle(
                                  color: Color(0xFFFFD700),
                                  fontSize: 8.5,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.2,
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

              const SizedBox(width: 48),

              // ── 2. Navigation Links ────────────────────────────────
              Expanded(
                child: Row(
                  children: [
                    _buildNavLink(
                      context,
                      label: 'Explore',
                      icon: Icons.explore_outlined,
                      isActive: currentIndex == 0,
                      onTap: () {
                        if (onTabSelected != null) {
                          onTabSelected!(0);
                        } else {
                          context.go('/home');
                        }
                      },
                    ),
                    const SizedBox(width: 8),
                    _buildNavLink(
                      context,
                      label: 'Venues & Palaces',
                      icon: Icons.castle_outlined,
                      isActive: false,
                      onTap: () => context.push('/venues'),
                    ),
                    const SizedBox(width: 8),
                    _buildNavLink(
                      context,
                      label: 'Production Crews',
                      icon: Icons.speaker_group_outlined,
                      isActive: currentIndex == 1,
                      onTap: () {
                        if (onTabSelected != null) {
                          onTabSelected!(1);
                        } else {
                          context.push('/vendors');
                        }
                      },
                    ),
                    const SizedBox(width: 8),
                    _buildNavLink(
                      context,
                      label: '5-Step AI Planner',
                      icon: Icons.auto_awesome_rounded,
                      isActive: currentIndex == 2,
                      onTap: () {
                        if (onTabSelected != null) {
                          onTabSelected!(2);
                        } else {
                          context.go('/planner');
                        }
                      },
                    ),
                    const SizedBox(width: 8),
                    _buildNavLink(
                      context,
                      label: 'Become a Partner',
                      icon: Icons.handshake_outlined,
                      isActive: false,
                      onTap: () => context.push('/become-vendor'),
                    ),
                  ],
                ),
              ),

              // ── 3. Right Action Area ───────────────────────────────
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // City Indicator
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.location_on, color: AppColors.primary, size: 14),
                        SizedBox(width: 6),
                        Text(
                          'Raipur, India',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: 16),

                  if (!isAuthenticated) ...[
                    // Sign In CTA
                    OutlinedButton(
                      onPressed: () => context.push('/login'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0x33FFFFFF)),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Sign In', style: TextStyle(fontWeight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton(
                      onPressed: () => context.push('/signup'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Get Started',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ] else ...[
                    // "+ New Event" Button
                    ElevatedButton.icon(
                      onPressed: () => CreateEventSheet.show(context),
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('New Event', style: TextStyle(fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 2,
                      ),
                    ),
                    const SizedBox(width: 16),

                    // Role Badge / Portal Switch
                    if (role == 'admin') ...[
                      InkWell(
                        onTap: () => context.push('/admin'),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.redAccent.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.redAccent.withOpacity(0.4)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.shield, color: Colors.redAccent, size: 14),
                              SizedBox(width: 4),
                              Text('Admin Panel', style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ] else if (role == 'vendor') ...[
                      InkWell(
                        onTap: () => context.push('/vendor'),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.storefront, color: AppColors.primary, size: 14),
                              SizedBox(width: 4),
                              Text('Vendor Portal', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],

                    // Sign Out Action
                    IconButton(
                      icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary, size: 20),
                      tooltip: 'Sign Out',
                      onPressed: () async {
                        await authStateNotifier.signOut();
                        if (context.mounted) {
                          context.go('/home');
                        }
                      },
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavLink(
    BuildContext context, {
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 16,
              color: isActive ? AppColors.primary : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primary : AppColors.textPrimary,
                fontSize: 14,
                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
