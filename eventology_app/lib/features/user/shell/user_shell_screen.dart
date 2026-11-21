import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/web_nav_bar.dart';
import '../events/widgets/create_event_sheet.dart';

class UserShellScreen extends StatefulWidget {
  final StatefulNavigationShell navigationShell;

  const UserShellScreen({super.key, required this.navigationShell});

  static _UserShellScreenState of(BuildContext context) {
    return context.findAncestorStateOfType<_UserShellScreenState>()!;
  }

  @override
  State<UserShellScreen> createState() => _UserShellScreenState();
}

class _UserShellScreenState extends State<UserShellScreen> {
  void changeTab(int index) {
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 960;

    return Scaffold(
      extendBody: !isDesktop, // Only extend body under bottom nav on mobile
      appBar: isDesktop
          ? WebNavBar(
              currentIndex: widget.navigationShell.currentIndex,
              onTabSelected: changeTab,
            )
          : null,
      body: widget.navigationShell,
      bottomNavigationBar: isDesktop
          ? null
          : ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: Container(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).padding.bottom + 16,
                    top: 16,
                    left: 24,
                    right: 24,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.background.withOpacity(0.95),
                    border: const Border(
                      top: BorderSide(color: AppColors.glassBorder, width: 1),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      _buildNavItem(0, Icons.explore_rounded, 'Explore'),
                      _buildNavItem(1, Icons.storefront_rounded, 'Catalog'),
                      _buildFab(context),
                      _buildNavItem(2, Icons.layers_rounded, 'My Events'),
                      _buildNavItem(3, Icons.person_rounded, 'Profile'),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label) {
    final isSelected = widget.navigationShell.currentIndex == index;
    return GestureDetector(
      onTap: () => changeTab(index),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 52,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.primary : AppColors.textSecondary,
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFab(BuildContext context) {
    return GestureDetector(
      onTap: () => CreateEventSheet.show(context),
      child: Transform.translate(
        offset: const Offset(0, -20),
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [AppColors.primary, Color(0xFFD4AF37)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withOpacity(0.3),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: const Icon(
            Icons.add,
            color: Colors.black,
            size: 28,
          ),
        ),
      ),
    );
  }
}
