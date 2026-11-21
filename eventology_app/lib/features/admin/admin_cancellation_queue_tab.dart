import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../models/cancellation_model.dart';
import '../../services/cancellation_api_service.dart';

class AdminCancellationQueueView extends StatefulWidget {
  final CancellationApiService? apiService;

  const AdminCancellationQueueView({super.key, this.apiService});

  @override
  State<AdminCancellationQueueView> createState() =>
      _AdminCancellationQueueViewState();
}

class _AdminCancellationQueueViewState extends State<AdminCancellationQueueView> {
  late final CancellationApiService _apiService;
  bool _isLoading = true;
  String? _errorMessage;
  List<CancellationRequestModel> _queue = [];

  String _searchQuery = '';
  String _statusFilter = 'All';

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? cancellationApiService;
    _loadQueue();
  }

  Future<void> _loadQueue() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final items = await _apiService.fetchAdminQueue(
        status: _statusFilter != 'All' ? _statusFilter : null,
      );
      if (mounted) {
        setState(() {
          _queue = items;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildFilters(),
        Expanded(child: _buildContent()),
      ],
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('admin_cancellation_search_input'),
                  decoration: InputDecoration(
                    hintText: 'Search by Booking ID, Customer, Request ID...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    filled: true,
                    fillColor: AppColors.surfaceLighter,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.glassBorder),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  ),
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                ),
              ),
              const SizedBox(width: 12),
              DropdownButton<String>(
                value: _statusFilter,
                dropdownColor: AppColors.surface,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                items: [
                  'All',
                  'cancellation_requested',
                  'cancellation_approved',
                  'cancellation_rejected',
                  'cancellation_completed',
                  'request_withdrawn',
                ].map((s) {
                  return DropdownMenuItem(
                    value: s,
                    child: Text(_formatFilterLabel(s)),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _statusFilter = val);
                    _loadQueue();
                  }
                },
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.primary),
                tooltip: 'Refresh Queue',
                onPressed: _loadQueue,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatFilterLabel(String status) {
    switch (status) {
      case 'cancellation_requested':
        return 'Pending Review';
      case 'cancellation_approved':
        return 'Approved';
      case 'cancellation_rejected':
        return 'Rejected';
      case 'cancellation_completed':
        return 'Completed';
      case 'request_withdrawn':
        return 'Withdrawn';
      default:
        return 'All Requests';
    }
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Error loading queue: $_errorMessage', style: const TextStyle(color: AppColors.error)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _loadQueue,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    var filtered = _queue;
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((r) {
        return r.bookingId.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            r.customerId.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            r.requestId.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            r.vendorId.toLowerCase().contains(_searchQuery.toLowerCase());
      }).toList();
    }

    if (filtered.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Text(
            'No cancellation requests match the active filters.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        return _buildRequestCard(filtered[index]);
      },
    );
  }

  Widget _buildRequestCard(CancellationRequestModel req) {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Request #${req.requestId.length > 8 ? req.requestId.substring(0, 8).toUpperCase() : req.requestId.toUpperCase()}',
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Booking: ${req.bookingId} • Customer: ${req.customerId}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
              ),
              _buildBadge(req),
            ],
          ),
          const SizedBox(height: 8),

          // Settlement Conflict Warning Banner
          if (req.hasSettlementConflict) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      req.settlementConflictDetails ?? 'Active/paid vendor settlement detected.',
                      style: const TextStyle(color: Color(0xFFFCD34D), fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],

          const Divider(color: AppColors.glassBorder, height: 16),

          // Financial Amounts
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Gross Paid', style: TextStyle(color: AppColors.textSecondary, fontSize: 10)),
                    Text(
                      '₹${formatter.format(req.calculation.grossPaidINR)}',
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Deduction', style: TextStyle(color: AppColors.textSecondary, fontSize: 10)),
                    Text(
                      '- ₹${formatter.format(req.calculation.deductionINR)}',
                      style: const TextStyle(color: Color(0xFFF87171), fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      req.isApproved
                          ? 'Approved Refund'
                          : (req.isRefundConfirmed ? 'Refund Executed' : 'Estimated Refund'),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                    ),
                    Text(
                      req.calculation.approvedRefundINR != null
                          ? '₹${formatter.format(req.calculation.approvedRefundINR!)}'
                          : '₹${formatter.format(req.calculation.refundEstimateINR)}',
                      style: const TextStyle(color: Color(0xFF34D399), fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Customer Reason Snippet
          Text(
            'Reason: ${req.reason}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 12),

          // Action Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              key: Key('admin_review_btn_${req.requestId}'),
              onPressed: () => _openReviewDialog(req),
              icon: const Icon(Icons.gavel_rounded, size: 16),
              label: Text(
                req.isPendingReview
                    ? 'Review & Decide'
                    : (req.refundStatus == 'refund_approved' ? 'Execute Refund' : 'View Decision Audit'),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: req.isPendingReview ? AppColors.primary : AppColors.surfaceLighter,
                foregroundColor: req.isPendingReview ? Colors.black : Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(CancellationRequestModel req) {
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

  void _openReviewDialog(CancellationRequestModel req) {
    showDialog(
      context: context,
      builder: (ctx) => _AdminCancellationDecisionDialog(
        request: req,
        apiService: _apiService,
        onSuccess: _loadQueue,
      ),
    );
  }
}

class _AdminCancellationDecisionDialog extends StatefulWidget {
  final CancellationRequestModel request;
  final CancellationApiService apiService;
  final VoidCallback onSuccess;

  const _AdminCancellationDecisionDialog({
    required this.request,
    required this.apiService,
    required this.onSuccess,
  });

  @override
  State<_AdminCancellationDecisionDialog> createState() =>
      _AdminCancellationDecisionDialogState();
}

class _AdminCancellationDecisionDialogState
    extends State<_AdminCancellationDecisionDialog> {
  final _reasonCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _refundPaiseCtrl = TextEditingController();

  String _refundDecision = 'approve_refund';
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final estRefund = widget.request.calculation.refundEstimatePaise;
    _refundPaiseCtrl.text = estRefund.toString();
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    _notesCtrl.dispose();
    _refundPaiseCtrl.dispose();
    super.dispose();
  }

  Future<void> _approve() async {
    final reason = _reasonCtrl.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'Decision reason is mandatory.');
      return;
    }

    int? paise;
    if (_refundDecision == 'approve_refund') {
      paise = int.tryParse(_refundPaiseCtrl.text.trim());
      if (paise == null || paise < 0) {
        setState(() => _error = 'Enter a valid refund amount in paise.');
        return;
      }
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await widget.apiService.approveCancellation(
        requestId: widget.request.requestId,
        decisionReason: reason,
        adminInternalNotes: _notesCtrl.text.trim(),
        refundDecision: _refundDecision,
        approvedRefundPaise: paise,
      );

      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cancellation approved successfully.')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _reject() async {
    final reason = _reasonCtrl.text.trim();
    if (reason.isEmpty) {
      setState(() => _error = 'Mandatory decision reason is required when rejecting cancellation.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await widget.apiService.rejectCancellation(
        requestId: widget.request.requestId,
        decisionReason: reason,
        adminInternalNotes: _notesCtrl.text.trim(),
      );

      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cancellation request rejected.')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _executeRefund() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      await widget.apiService.executeRefund(widget.request.requestId);
      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Simulated refund executed in sandbox test-double mode.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final req = widget.request;
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');

    return Dialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.glassBorder),
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 580),
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Text(
                      'Administrative Cancellation Review',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
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
                'Request: ${req.requestId} • Booking: ${req.bookingId}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
              ),
              const SizedBox(height: 14),

              // Settlement Conflict Warning
              if (req.hasSettlementConflict) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Settlement Reservation Conflict / Exception',
                            style: TextStyle(color: Color(0xFFFCD34D), fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        req.settlementConflictDetails ??
                            'Active or paid settlements exist for this allocation. Approving cancellation will reverse approved settlements or route paid settlements to administrative escalation.',
                        style: const TextStyle(color: Colors.white70, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // Provenance Details
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLighter,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildRow('Customer ID:', req.customerId),
                    _buildRow('Vendor ID:', req.vendorId),
                    if (req.allocationId != null) _buildRow('Allocation ID:', req.allocationId!),
                    _buildRow('Policy Tier:', req.calculation.windowTier),
                    _buildRow('Gross Paid:', '₹${formatter.format(req.calculation.grossPaidINR)}'),
                    _buildRow(
                      'Policy Deduction:',
                      '- ₹${formatter.format(req.calculation.deductionINR)} (${(req.calculation.deductionBps / 100).toStringAsFixed(0)}%)',
                      valueColor: const Color(0xFFF87171),
                    ),
                    _buildRow(
                      'Estimated Refund:',
                      '₹${formatter.format(req.calculation.refundEstimateINR)}',
                      valueColor: const Color(0xFF34D399),
                      isBold: true,
                    ),
                    const SizedBox(height: 6),
                    Text('Customer Reason: ${req.reason}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // If Still Pending Review: Decision Controls
              if (req.isPendingReview) ...[
                const Text(
                  'Decision Reason * (Sent to Customer & Vendor)',
                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const Key('admin_decision_reason_input'),
                  controller: _reasonCtrl,
                  maxLines: 2,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Formal reason explaining approval or rejection...',
                    hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.surfaceLighter,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 12),

                const Text(
                  'Internal Admin Notes (Never exposed to customer or vendor)',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const Key('admin_internal_notes_input'),
                  controller: _notesCtrl,
                  maxLines: 2,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Internal records, phone verification logs, escalation details...',
                    hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.surfaceLighter,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 14),

                const Text(
                  'Refund Determination:',
                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: _refundDecision,
                  isExpanded: true,
                  dropdownColor: AppColors.surface,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: AppColors.surfaceLighter,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'approve_refund', child: Text('Approve Commercial Refund')),
                    DropdownMenuItem(value: 'reject_refund', child: Text('Reject Refund (No Return of Funds)')),
                    DropdownMenuItem(value: 'none', child: Text('No Financial Refund (Unpaid / Ineligible)')),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _refundDecision = val);
                  },
                ),

                if (_refundDecision == 'approve_refund') ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Approved Refund Amount in Paise *',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    key: const Key('admin_approved_paise_input'),
                    controller: _refundPaiseCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Amount in paise (e.g. 9500000 = ₹95,000.00)',
                      filled: true,
                      fillColor: AppColors.surfaceLighter,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],

                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                ],

                const SizedBox(height: 20),

                // Decision Action Buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        key: const Key('confirm_reject_cancellation_btn'),
                        onPressed: _isSubmitting ? null : _reject,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFEF4444),
                          side: const BorderSide(color: Color(0xFFEF4444)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('Reject Cancellation'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        key: const Key('confirm_approve_cancellation_btn'),
                        onPressed: _isSubmitting ? null : _approve,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Approve Cancellation', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ] else if (req.refundStatus == 'refund_approved') ...[
                // Refund Execution Action
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Simulated Sandbox Refund Execution',
                        style: TextStyle(color: Color(0xFF60A5FA), fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'This execution updates internal financial ledgers in sandbox test-double mode. Automated external banking disbursements remain unconfigured (payout_not_configured).',
                        style: TextStyle(color: Color(0xFF93C5FD), fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    key: const Key('confirm_execute_refund_btn'),
                    onPressed: _isSubmitting ? null : _executeRefund,
                    icon: const Icon(Icons.currency_rupee_rounded, size: 16),
                    label: _isSubmitting
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text('Execute Simulated Refund', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
              ] else ...[
                // Already Decided / Historical View
                if (req.decisionReason != null) ...[
                  Text('Decision Note: ${req.decisionReason}', style: const TextStyle(color: Colors.white, fontSize: 12)),
                  const SizedBox(height: 4),
                ],
                if (req.adminInternalNotes != null) ...[
                  Text('Internal Staff Notes: ${req.adminInternalNotes}',
                      style: const TextStyle(color: Colors.white60, fontSize: 11, fontStyle: FontStyle.italic)),
                  const SizedBox(height: 4),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close Review'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isBold ? Colors.white : AppColors.textSecondary,
              fontSize: 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? Colors.white,
              fontSize: isBold ? 12 : 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
