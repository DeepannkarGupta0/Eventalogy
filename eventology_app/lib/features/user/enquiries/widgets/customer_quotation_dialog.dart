import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/enquiries_model.dart';
import '../../../../models/quotations_model.dart';
import '../../../../services/quotation_api_service.dart';

/// Modal dialog allowing a customer to review, accept, or decline a vendor's quotation.
class CustomerQuotationDialog extends StatefulWidget {
  final EnquiryModel enquiry;
  final QuotationApiService apiService;
  final VoidCallback? onStatusChanged;

  const CustomerQuotationDialog({
    super.key,
    required this.enquiry,
    required this.apiService,
    this.onStatusChanged,
  });

  @override
  State<CustomerQuotationDialog> createState() => _CustomerQuotationDialogState();
}

class _CustomerQuotationDialogState extends State<CustomerQuotationDialog> {
  bool _isLoading = true;
  String? _fetchError;
  QuotationModel? _quotation;

  bool _isActionSubmitting = false;
  String? _actionError;
  String? _successMessage;
  String? _confirmedBookingId;

  @override
  void initState() {
    super.initState();
    _loadQuotation();
  }

  Future<void> _loadQuotation() async {
    setState(() {
      _isLoading = true;
      _fetchError = null;
    });

    try {
      final quotes = await widget.apiService.fetchQuotationsForEnquiry(widget.enquiry.enquiryId);
      if (mounted) {
        setState(() {
          _isLoading = false;
          _quotation = quotes.isNotEmpty ? quotes.first : null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _fetchError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _handleAccept() async {
    final quote = _quotation;
    if (quote == null || _isActionSubmitting) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Confirm Quotation Acceptance',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Accepting will lock in vendor availability and generate a confirmed booking for ${quote.formattedTotal}.',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceLighter,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: AppColors.primary),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Payment checkout is handled separately under bookings.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Accept & Book', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isActionSubmitting = true;
      _actionError = null;
    });

    try {
      final res = await widget.apiService.acceptQuotation(quote.quotationId);
      final updatedQuote = res['quotation'] as QuotationModel;
      final bookingId = res['bookingId'] as String? ?? updatedQuote.bookingId;

      if (mounted) {
        setState(() {
          _isActionSubmitting = false;
          _quotation = updatedQuote;
          _confirmedBookingId = bookingId;
          _successMessage = 'Quotation accepted! Confirmed booking has been created.';
        });
        widget.onStatusChanged?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isActionSubmitting = false;
          _actionError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _handleDecline() async {
    final quote = _quotation;
    if (quote == null || _isActionSubmitting) return;

    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Decline Quotation',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Are you sure you want to decline this quote? The vendor will be notified.',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Optional decline reason (e.g., budget exceeded, dates changed)',
                hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                filled: true,
                fillColor: AppColors.surfaceLighter,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.glassBorder),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Decline Quote', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isActionSubmitting = true;
      _actionError = null;
    });

    try {
      final updatedQuote = await widget.apiService.declineQuotation(
        quote.quotationId,
        reasonCtrl.text.trim().isNotEmpty ? reasonCtrl.text.trim() : null,
      );

      if (mounted) {
        setState(() {
          _isActionSubmitting = false;
          _quotation = updatedQuote;
          _successMessage = 'Quotation declined.';
        });
        widget.onStatusChanged?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isActionSubmitting = false;
          _actionError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520, maxHeight: 720),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'QUOTATION DETAILS',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(color: AppColors.glassBorder, height: 1),
              const SizedBox(height: 12),

              // Content Body
              Expanded(
                child: _buildBody(),
              ),

              // Bottom Action Footer
              if (_quotation != null && _buildActions() != null) ...[
                const SizedBox(height: 12),
                const Divider(color: AppColors.glassBorder, height: 1),
                const SizedBox(height: 12),
                _buildActions()!,
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.primary),
            SizedBox(height: 14),
            Text('Fetching quotation details...', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ],
        ),
      );
    }

    if (_fetchError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 40),
            const SizedBox(height: 12),
            Text(
              _fetchError!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadQuotation,
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final quote = _quotation;
    if (quote == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.hourglass_empty_rounded, color: AppColors.textSecondary, size: 40),
            const SizedBox(height: 12),
            const Text(
              'No Quotation Available',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'The vendor has not submitted a formal quotation for this enquiry yet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      );
    }

    final isExpired = quote.status == 'expired' || (quote.status == 'submitted' && DateTime.now().isAfter(quote.validUntil));
    final expiryFormatted = DateFormat('dd MMM yyyy').format(quote.validUntil);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Alerts
          if (_actionError != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.error),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 16, color: AppColors.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_actionError!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                  ),
                ],
              ),
            ),

          if (_successMessage != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF10B981)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.check_circle_outline, size: 16, color: Color(0xFF10B981)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _successMessage!,
                          style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  if (_confirmedBookingId != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Booking Reference: $_confirmedBookingId',
                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),

          // Quotation ID & Status Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Quote #${quote.quotationId.length > 8 ? quote.quotationId.substring(0, 8).toUpperCase() : quote.quotationId.toUpperCase()}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              _buildQuotationBadge(isExpired ? 'expired' : quote.status),
            ],
          ),
          const SizedBox(height: 8),

          // Expiry details
          Row(
            children: [
              Icon(
                isExpired ? Icons.event_busy_rounded : Icons.schedule_rounded,
                size: 14,
                color: isExpired ? AppColors.error : AppColors.textSecondary,
              ),
              const SizedBox(width: 6),
              Text(
                isExpired ? 'Expired on $expiryFormatted' : 'Valid until $expiryFormatted',
                style: TextStyle(
                  color: isExpired ? AppColors.error : AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: isExpired ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Line Items Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceLighter,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('ITEM & DESCRIPTION', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
                    Text('AMOUNT', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 8),
                const Divider(color: AppColors.glassBorder, height: 1),
                const SizedBox(height: 8),
                ...quote.lineItems.map(
                  (item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.description,
                                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                              ),
                              Text(
                                '${item.quantity} × ${item.formattedUnitPrice}',
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          item.formattedTotal,
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Divider(color: AppColors.glassBorder, height: 1),
                const SizedBox(height: 8),

                // Subtotal & Tax
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Subtotal', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    Text(quote.formattedSubtotal, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Taxes & GST', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    Text(quote.formattedTax, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 8),
                const Divider(color: AppColors.glassBorder, height: 1),
                const SizedBox(height: 8),

                // Total Amount
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('TOTAL PAYABLE', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                    Text(
                      quote.formattedTotal,
                      style: const TextStyle(color: AppColors.primary, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Inclusions & Exclusions
          if (quote.inclusions.isNotEmpty) ...[
            const Text('Inclusions:', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: quote.inclusions
                  .map(
                    (inc) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.check, size: 12, color: Color(0xFF10B981)),
                          const SizedBox(width: 4),
                          Text(inc, style: const TextStyle(color: Colors.white, fontSize: 11)),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
          ],

          if (quote.exclusions.isNotEmpty) ...[
            const Text('Exclusions:', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: quote.exclusions
                  .map(
                    (exc) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.close, size: 12, color: AppColors.error),
                          const SizedBox(width: 4),
                          Text(exc, style: const TextStyle(color: Colors.white, fontSize: 11)),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
          ],

          // Notes
          if (quote.notes != null && quote.notes!.isNotEmpty) ...[
            const Text('Vendor Notes:', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceLighter,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Text(
                quote.notes!,
                style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.3),
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Operational notice
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.surfaceLighter,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.shield_outlined, size: 16, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Operational notice: Acceptance creates an atomic confirmed booking and reserves vendor allocation. Booking remains unpaid until checkout.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 11, height: 1.3),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget? _buildActions() {
    final quote = _quotation;
    if (quote == null) return null;

    final isExpired = quote.status == 'expired' || (quote.status == 'submitted' && DateTime.now().isAfter(quote.validUntil));

    if (quote.status == 'submitted' && !isExpired) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              key: const Key('decline_quote_btn'),
              onPressed: _isActionSubmitting ? null : _handleDecline,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: _isActionSubmitting
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.error))
                  : const Text('Decline Quote', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              key: const Key('accept_quote_btn'),
              onPressed: _isActionSubmitting ? null : _handleAccept,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: _isActionSubmitting
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Accept & Book', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            ),
          ),
        ],
      );
    }

    if (quote.status == 'accepted') {
      final bookingId = _confirmedBookingId ?? quote.bookingId;
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: const Text(
              '✓ QUOTATION ACCEPTED & BOOKED',
              style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 12),
            ),
          ),
          if (bookingId != null && bookingId.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                key: const Key('proceed_to_checkout_btn'),
                onPressed: () {
                  Navigator.of(context).pop();
                  context.push('/booking-checkout/$bookingId');
                },
                icon: const Icon(Icons.payment_rounded, size: 16),
                label: const Text('Proceed to Booking Checkout', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
          ],
        ],
      );
    }

    if (quote.status == 'declined') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        alignment: Alignment.center,
        child: const Text(
          'QUOTATION DECLINED',
          style: TextStyle(color: AppColors.error, fontWeight: FontWeight.bold, fontSize: 12),
        ),
      );
    }

    if (isExpired) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white10,
          borderRadius: BorderRadius.circular(8),
        ),
        alignment: Alignment.center,
        child: const Text(
          'QUOTATION EXPIRED',
          style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.bold, fontSize: 12),
        ),
      );
    }

    return null;
  }

  Widget _buildQuotationBadge(String status) {
    Color color;
    String label;

    switch (status.toLowerCase()) {
      case 'accepted':
        color = const Color(0xFF10B981);
        label = 'ACCEPTED';
        break;
      case 'declined':
        color = AppColors.error;
        label = 'DECLINED';
        break;
      case 'expired':
        color = AppColors.textSecondary;
        label = 'EXPIRED';
        break;
      case 'submitted':
      default:
        color = const Color(0xFF06B6D4);
        label = 'PENDING REVIEW';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5),
      ),
    );
  }
}
