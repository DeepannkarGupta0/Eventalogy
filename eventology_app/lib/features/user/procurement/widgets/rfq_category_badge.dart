import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class RfqCategoryBadge extends StatelessWidget {
  final String category;
  final bool compact;

  const RfqCategoryBadge({
    super.key,
    required this.category,
    this.compact = false,
  });

  static IconData getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'audio':
        return Icons.volume_up_rounded;
      case 'lighting':
        return Icons.lightbulb_rounded;
      case 'video':
        return Icons.tv_rounded;
      case 'rigging':
        return Icons.construction_rounded;
      case 'power':
        return Icons.bolt_rounded;
      case 'staging':
        return Icons.layers_rounded;
      case 'backline':
        return Icons.music_note_rounded;
      default:
        return Icons.category_rounded;
    }
  }

  static Color getCategoryColor(String category) {
    switch (category.toLowerCase()) {
      case 'audio':
        return const Color(0xFF00E5FF); // Vibrant Cyan
      case 'lighting':
        return AppColors.primary; // Gold
      case 'video':
        return const Color(0xFFA855F7); // Purple
      case 'rigging':
        return const Color(0xFFFF9100); // Amber/Orange
      case 'power':
        return const Color(0xFFFFEA00); // Electric Yellow
      case 'staging':
        return const Color(0xFF3B82F6); // Blue
      case 'backline':
        return const Color(0xFFEC4899); // Pink
      default:
        return Colors.white70;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = getCategoryColor(category);
    final icon = getCategoryIcon(category);

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(
              category.toUpperCase(),
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            category,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
