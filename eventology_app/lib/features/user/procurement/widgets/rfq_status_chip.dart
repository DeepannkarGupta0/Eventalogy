import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class RfqStatusChip extends StatelessWidget {
  final String status;

  const RfqStatusChip({super.key, required this.status});

  static Color getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
        return const Color(0xFF10B981); // Emerald Green
      case 'quoted':
        return AppColors.primary; // Gold
      case 'acknowledged':
        return const Color(0xFF8B5CF6); // Purple
      case 'dispatched':
        return const Color(0xFF3B82F6); // Blue
      case 'declined':
        return AppColors.error; // Red
      case 'draft':
      default:
        return AppColors.textSecondary;
    }
  }

  static IconData getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
        return Icons.check_circle_rounded;
      case 'quoted':
        return Icons.request_quote_rounded;
      case 'acknowledged':
        return Icons.visibility_rounded;
      case 'dispatched':
        return Icons.send_rounded;
      case 'declined':
        return Icons.cancel_rounded;
      case 'draft':
      default:
        return Icons.hourglass_empty_rounded;
    }
  }

  static String getStatusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'ACCEPTED';
      case 'quoted':
        return 'QUOTED';
      case 'acknowledged':
        return 'ACKNOWLEDGED';
      case 'dispatched':
        return 'DISPATCHED';
      case 'declined':
        return 'DECLINED';
      case 'draft':
      default:
        return 'DRAFT';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = getStatusColor(status);
    final icon = getStatusIcon(status);
    final label = getStatusLabel(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}
