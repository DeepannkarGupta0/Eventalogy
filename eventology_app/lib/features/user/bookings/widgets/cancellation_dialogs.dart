import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/bookings_model.dart';
import '../../../../models/cancellation_model.dart';
import '../../../../services/cancellation_api_service.dart';

/// Modal dialog for customer to preview policy estimate and submit cancellation request.
class CustomerCancellationRequestDialog extends StatefulWidget {
  final BookingModel booking;
  final CancellationApiService? apiService;
  final VoidCallback? onSuccess;

  const CustomerCancellationRequestDialog({
    super.key,
    required this.booking,
    this.apiService,
    this.onSuccess,
  });

  @override
  State<CustomerCancellationRequestDialog> createState() =>
      _CustomerCancellationRequestDialogState();
}

class _CustomerCancellationRequestDialogState
    extends State<CustomerCancellationRequestDialog> {
  late final CancellationApiService _apiService;
  final _reasonController = TextEditingController();
  final _notesController = TextEditingController();

  CancellationCalculationModel? _estimate;
  bool _isLoadingEstimate = true;
  String? _estimateError;

  bool _isSubmitting = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? cancellationApiService;
    _fetchEstimate();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _fetchEstimate() async {
    setState(() {
      _isLoadingEstimate = true;
      _estimateError = null;
    });

    try {
      final est = await _apiService.fetchEstimate(widget.booking.bookingId);
      if (mounted) {
        setState(() {
          _estimate = est;
          _isLoadingEstimate = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _estimateError = e.toString().replaceAll('Exception: ', '');
          _isLoadingEstimate = false;
        });
      }
    }
  }

  Future<void> _submitRequest() async {
    final reason = _reasonController.text.trim();
    if (reason.length < 5) return;

    setState(() {
      _isSubmitting = true;
      _submitError = null;
    });

    try {
      await _apiService.requestCancellation(
        bookingId: widget.booking.bookingId,
        reason: reason,
        customerNotes: _notesController.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).pop(true);
        widget.onSuccess?.call();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cancellation request submitted for administrative review.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitError = e.toString().replaceAll('Exception: ', '');
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');

    return Dialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.glassBorder),
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 520),
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Row(
                      children: [
                        Icon(Icons.cancel_outlined, color: AppColors.error, size: 22),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Request Cancellation',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Booking #${widget.booking.bookingId.length > 8 ? widget.booking.bookingId.substring(0, 8).toUpperCase() : widget.booking.bookingId.toUpperCase()}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 16),

              // Consequences Disclaimer
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Submitting this request will pause fulfillment and submit your booking to administrative policy review. Cancellation approval and refunds are subject to contract terms.',
                        style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Policy Calculation Preview
              if (_isLoadingEstimate)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                )
              else if (_estimateError != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLighter,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: AppColors.textSecondary, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _estimateError!,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ),
                      TextButton(
                        onPressed: _fetchEstimate,
                        child: const Text('Retry', style: TextStyle(color: AppColors.primary)),
                      ),
                    ],
                  ),
                )
              else if (_estimate != null)
                _buildEstimateCard(_estimate!, formatter),

              const SizedBox(height: 18),

              // Cancellation Reason Field
              const Text(
                'Reason for Cancellation *',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                key: const Key('cancellation_reason_input'),
                controller: _reasonController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'e.g., Date postponement, personal emergency, scheduling conflict...',
                  hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                  filled: true,
                  fillColor: AppColors.surfaceLighter,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),

              // Optional Additional Notes
              const Text(
                'Additional Notes (Optional)',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                key: const Key('cancellation_notes_input'),
                controller: _notesController,
                maxLines: 2,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Any specific instructions or details for event team...',
                  hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                  filled: true,
                  fillColor: AppColors.surfaceLighter,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                ),
              ),

              if (_submitError != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    _submitError!,
                    style: const TextStyle(color: AppColors.error, fontSize: 12),
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // Submit / Cancel Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: AppColors.glassBorder),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Keep Booking'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      key: const Key('submit_cancellation_btn'),
                      onPressed: (_reasonController.text.trim().length >= 5 && !_isSubmitting)
                          ? _submitRequest
                          : null,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.error,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: AppColors.surfaceLighter,
                        disabledForegroundColor: Colors.white24,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Confirm Request', style: TextStyle(fontWeight: FontWeight.bold)),
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

  Widget _buildEstimateCard(CancellationCalculationModel est, NumberFormat formatter) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Text(
                  'Commercial Policy Assessment',
                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  est.policyVersion,
                  style: const TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _buildRow('Gross Paid Amount:', '₹${formatter.format(est.grossPaidINR)}'),
          const SizedBox(height: 6),
          _buildRow(
            'Policy Deduction (${(est.deductionBps / 100).toStringAsFixed(0)}%):',
            '- ₹${formatter.format(est.deductionINR)}',
            valueColor: const Color(0xFFF87171),
          ),
          const Divider(color: AppColors.glassBorder, height: 16),
          _buildRow(
            'Estimated Refund:',
            '₹${formatter.format(est.refundEstimateINR)}',
            isBold: true,
            valueColor: const Color(0xFF34D399),
          ),
          const SizedBox(height: 8),
          Text(
            est.rationale,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 4),
          const Text(
            '* Notice: Customer-facing refund amounts are policy estimates and must be formally confirmed by an administrator.',
            style: TextStyle(color: Colors.white38, fontSize: 10),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: isBold ? Colors.white : AppColors.textSecondary,
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? Colors.white,
            fontSize: isBold ? 14 : 12,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/// Bottom sheet displaying the full review details of an existing cancellation request.
class CustomerCancellationStatusModal extends StatefulWidget {
  final CancellationRequestModel request;
  final CancellationApiService? apiService;
  final VoidCallback? onWithdrawn;

  const CustomerCancellationStatusModal({
    super.key,
    required this.request,
    this.apiService,
    this.onWithdrawn,
  });

  @override
  State<CustomerCancellationStatusModal> createState() =>
      _CustomerCancellationStatusModalState();
}

class _CustomerCancellationStatusModalState
    extends State<CustomerCancellationStatusModal> {
  late final CancellationApiService _apiService;
  bool _isWithdrawing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? cancellationApiService;
  }

  Future<void> _withdraw() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Withdraw Request?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Are you sure you want to withdraw this cancellation request and resume your booking?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep Cancellation', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
            child: const Text('Withdraw Request'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isWithdrawing = true;
      _error = null;
    });

    try {
      await _apiService.withdrawCancellation(widget.request.requestId);
      if (mounted) {
        Navigator.of(context).pop();
        widget.onWithdrawn?.call();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cancellation request withdrawn.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isWithdrawing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final req = widget.request;
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text(
                    'Cancellation & Refund Status',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 8),
                _buildStatusBadge(req),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Request Reference: #${req.requestId.length > 8 ? req.requestId.substring(0, 8).toUpperCase() : req.requestId.toUpperCase()}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 16),

            // Financial Breakdown Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceLighter,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Column(
                children: [
                  _buildRow('Gross Paid Amount:', '₹${formatter.format(req.calculation.grossPaidINR)}'),
                  const SizedBox(height: 6),
                  _buildRow(
                    'Policy Deductions:',
                    '- ₹${formatter.format(req.calculation.deductionINR)}',
                    valueColor: const Color(0xFFF87171),
                  ),
                  const Divider(color: AppColors.glassBorder, height: 16),
                  _buildRow(
                    req.isApproved
                        ? 'Approved Refund:'
                        : (req.isRefundConfirmed ? 'Refund Executed (Simulated):' : 'Estimated Refund:'),
                    req.calculation.approvedRefundINR != null
                        ? '₹${formatter.format(req.calculation.approvedRefundINR!)}'
                        : '₹${formatter.format(req.calculation.refundEstimateINR)}',
                    isBold: true,
                    valueColor: const Color(0xFF34D399),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Customer Reason
            const Text(
              'Submitted Reason:',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              req.reason,
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),

            // Decision Note (if approved or rejected)
            if (req.decisionReason != null && req.decisionReason!.isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: req.isApproved
                      ? const Color(0xFF10B981).withValues(alpha: 0.1)
                      : const Color(0xFFEF4444).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: req.isApproved
                        ? const Color(0xFF10B981).withValues(alpha: 0.3)
                        : const Color(0xFFEF4444).withValues(alpha: 0.3),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      req.isApproved ? 'Administrative Decision Note:' : 'Rejection Reason:',
                      style: TextStyle(
                        color: req.isApproved ? const Color(0xFF34D399) : const Color(0xFFF87171),
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      req.decisionReason!,
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],

            // Simulated Refund Notice
            if (req.isRefundConfirmed) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline, color: Color(0xFF60A5FA), size: 16),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Refund execution was recorded in sandbox test-double mode for system verification. No real money moved.',
                        style: TextStyle(color: Color(0xFF93C5FD), fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
            ],

            const SizedBox(height: 20),

            // Withdraw Button if still pending
            if (req.isPendingReview)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  key: const Key('withdraw_cancellation_btn'),
                  onPressed: _isWithdrawing ? null : _withdraw,
                  icon: const Icon(Icons.undo_rounded, size: 16),
                  label: _isWithdrawing
                      ? const SizedBox(
                          height: 14,
                          width: 14,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Withdraw Cancellation Request'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: const BorderSide(color: AppColors.glassBorder),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(CancellationRequestModel req) {
    Color color;
    String label = req.statusDisplayLabel;

    if (req.isApproved) {
      color = const Color(0xFF10B981);
    } else if (req.isRejected) {
      color = const Color(0xFFEF4444);
    } else if (req.isPendingReview) {
      color = const Color(0xFFF59E0B);
    } else {
      color = AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: isBold ? Colors.white : AppColors.textSecondary,
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? Colors.white,
            fontSize: isBold ? 14 : 12,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
