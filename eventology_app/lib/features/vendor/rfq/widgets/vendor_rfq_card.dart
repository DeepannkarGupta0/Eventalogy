import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../models/rfq_model.dart';
import '../../../user/procurement/widgets/rfq_category_badge.dart';
import '../../../user/procurement/widgets/rfq_status_chip.dart';

class VendorRfqCard extends StatefulWidget {
  final RfqPackageModel package;
  final bool isProcessing;
  final void Function(RfqPackageModel package)? onAcknowledge;
  final void Function(RfqPackageModel package)? onQuote;

  const VendorRfqCard({
    super.key,
    required this.package,
    this.isProcessing = false,
    this.onAcknowledge,
    this.onQuote,
  });

  @override
  State<VendorRfqCard> createState() => _VendorRfqCardState();
}

class _VendorRfqCardState extends State<VendorRfqCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final pkg = widget.package;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: pkg.isAccepted
              ? const Color(0xFF10B981).withValues(alpha: 0.6)
              : pkg.isQuoted
                  ? AppColors.primary.withValues(alpha: 0.4)
                  : AppColors.glassBorder,
          width: pkg.isAccepted ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    RfqCategoryBadge(category: pkg.category),
                    RfqStatusChip(status: pkg.status),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  pkg.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (pkg.eventName != null && pkg.eventName!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.event_outlined,
                        size: 13,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          pkg.eventName! +
                              (pkg.venueName != null
                                  ? ' • ${pkg.venueName}'
                                  : '') +
                              (pkg.guestCount != null
                                  ? ' (${pkg.guestCount} guests)'
                                  : ''),
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),

                // Financial Overview & Rates
                _buildFinancialOverview(pkg),

                // Status Specific Banners
                if (pkg.isAccepted) ...[
                  const SizedBox(height: 12),
                  _buildAwardedBanner(pkg),
                ] else if (pkg.isDeclined) ...[
                  const SizedBox(height: 12),
                  _buildDeclinedBanner(pkg),
                ] else if (pkg.notes != null && pkg.notes!.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Notes: ${pkg.notes}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],

                if (pkg.deliveryCommitment != null &&
                    pkg.deliveryCommitment!.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.local_shipping_outlined,
                        size: 13,
                        color: Color(0xFF10B981),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          pkg.deliveryCommitment!,
                          style: const TextStyle(
                            color: Color(0xFF10B981),
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 12),
                // Expand / Collapse Line Items Button
                InkWell(
                  onTap: () {
                    setState(() {
                      _isExpanded = !_isExpanded;
                    });
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${pkg.lineItems.length} Equipment Requirements',
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Icon(
                          _isExpanded
                              ? Icons.keyboard_arrow_up_rounded
                              : Icons.keyboard_arrow_down_rounded,
                          size: 18,
                          color: AppColors.primary,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Collapsible Line Items Breakdown
          if (_isExpanded) ...[
            const Divider(color: AppColors.glassBorder, height: 1),
            Container(
              color: AppColors.background.withValues(alpha: 0.5),
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ...pkg.lineItems.map((item) {
                    final itemPrice = pkg.itemPrices?.firstWhere(
                      (ip) => ip.itemName == item.name,
                      orElse: () => RfqItemPriceModel(
                        itemName: item.name,
                        quotedRatePaise: 0,
                      ),
                    );

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.check_circle_outline,
                            size: 14,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                if (item.specifications != null) ...[
                                  const SizedBox(height: 2),
                                  Text(
                                    item.specifications!,
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${item.quantity} ${item.unit}',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (itemPrice != null &&
                                  itemPrice.quotedRatePaise > 0)
                                Text(
                                  '₹${itemPrice.quotedRateInr.toStringAsFixed(0)}/ea',
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 11,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],

          // Card Action Footer
          if (!pkg.isTerminal) ...[
            const Divider(color: AppColors.glassBorder, height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  if (pkg.isDispatched) ...[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: widget.isProcessing
                            ? null
                            : () => widget.onAcknowledge?.call(pkg),
                        icon: const Icon(Icons.done_all_rounded, size: 16),
                        label: const Text('Acknowledge'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: AppColors.glassBorder),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: widget.isProcessing
                          ? null
                          : () => widget.onQuote?.call(pkg),
                      icon: Icon(
                        pkg.isQuoted
                            ? Icons.edit_note_rounded
                            : Icons.send_rounded,
                        size: 16,
                      ),
                      label: Text(
                        pkg.isQuoted ? 'Update Quotation' : 'Submit Quotation',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFinancialOverview(RfqPackageModel pkg) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.background.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'BASELINE ESTIMATE',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '₹${pkg.estimatedTotalInr.toStringAsFixed(0)}',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (pkg.quotedAmountInr != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'YOUR QUOTE',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '₹${pkg.quotedAmountInr!.toStringAsFixed(0)}',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white10,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Awaiting Quote',
                style: TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAwardedBanner(RfqPackageModel pkg) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF10B981).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: const Color(0xFF10B981).withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.verified, size: 16, color: Color(0xFF10B981)),
              SizedBox(width: 6),
              Text(
                'AWARDED TO YOU • ESCROW LINKED',
                style: TextStyle(
                  color: Color(0xFF10B981),
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          if (pkg.paymentMilestoneId != null) ...[
            const SizedBox(height: 4),
            Text(
              'Escrow Milestone: ${pkg.paymentMilestoneId}',
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 11,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDeclinedBanner(RfqPackageModel pkg) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Quotation Declined',
                  style: TextStyle(
                    color: AppColors.error,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (pkg.declineReason != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Reason: ${pkg.declineReason}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
