import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/settlements_model.dart';
import '../../../services/settlement_api_service.dart';

class VendorSettlementsLedgerView extends StatefulWidget {
  final SettlementApiService? apiService;

  const VendorSettlementsLedgerView({
    super.key,
    this.apiService,
  });

  @override
  State<VendorSettlementsLedgerView> createState() => _VendorSettlementsLedgerViewState();
}

class _VendorSettlementsLedgerViewState extends State<VendorSettlementsLedgerView> {
  late final SettlementApiService _apiService;
  late Future<VendorSettlementHistoryResponseModel> _futureHistory;

  String _selectedFilter = 'all'; // 'all', 'pending_approval', 'approved', 'paid', 'rejected'

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? SettlementApiService();
    _loadHistory();
  }

  void _loadHistory() {
    setState(() {
      _futureHistory = _apiService.fetchVendorSettlementHistory(
        status: _selectedFilter == 'all' ? null : _selectedFilter,
      );
    });
  }

  void _onFilterChanged(String filter) {
    if (_selectedFilter != filter) {
      setState(() {
        _selectedFilter = filter;
      });
      _loadHistory();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Settlement Statement Ledger',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              'Internal Vendor Financial Statements',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            key: const Key('vendor_settlements_refresh_button'),
            icon: const Icon(Icons.refresh_rounded, color: AppColors.primary),
            tooltip: 'Refresh Statement',
            onPressed: _loadHistory,
          ),
        ],
      ),
      body: FutureBuilder<VendorSettlementHistoryResponseModel>(
        future: _futureHistory,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 16),
                  Text(
                    'Loading settlement ledger...',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            );
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
                    const SizedBox(height: 16),
                    Text(
                      'Failed to load settlement statement',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      snapshot.error.toString().replaceAll('Exception: ', ''),
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      key: const Key('vendor_settlements_retry_button'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: _loadHistory,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Retry', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            );
          }

          final data = snapshot.data!;
          final summary = data.summary;
          final settlements = data.settlements;

          return RefreshIndicator(
            color: AppColors.primary,
            backgroundColor: AppColors.surface,
            onRefresh: () async => _loadHistory(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              children: [
                _buildSystemLimitationDisclaimer(summary.systemLimitationNotice),
                const SizedBox(height: 16),
                _buildOverviewCards(summary),
                const SizedBox(height: 16),
                _buildDeductionsTransparencyCard(summary),
                const SizedBox(height: 20),
                _buildFilterChips(),
                const SizedBox(height: 16),
                _buildSettlementsSection(settlements),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSystemLimitationDisclaimer(String notice) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceHighlight.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Disbursement Gateway Boundary',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  notice,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewCards(VendorSettlementSummaryModel summary) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'STATEMENT BALANCES BY STATUS',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _buildBalanceCard(
                title: 'Pending Review',
                subtitle: 'Under admin review',
                amount: summary.formattedPendingApproval,
                accentColor: const Color(0xFFF59E0B), // Amber
                icon: Icons.hourglass_top_rounded,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildBalanceCard(
                title: 'Approved Reserved',
                subtitle: 'Internal ledger reserved',
                amount: summary.formattedApprovedReserved,
                accentColor: AppColors.accentBlue,
                icon: Icons.verified_user_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _buildBalanceCard(
                title: 'Reconciled Paid',
                subtitle: 'Manual ledger recorded',
                amount: summary.formattedReconciledPaid,
                accentColor: const Color(0xFF10B981), // Emerald Green
                icon: Icons.check_circle_rounded,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildBalanceCard(
                title: 'Adjusted / Rejected',
                subtitle: 'Requires resubmission',
                amount: summary.formattedRejected,
                accentColor: AppColors.error,
                icon: Icons.cancel_outlined,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBalanceCard({
    required String title,
    required String subtitle,
    required String amount,
    required Color accentColor,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accentColor.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              Icon(icon, size: 16, color: accentColor),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            amount,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeductionsTransparencyCard(VendorSettlementSummaryModel summary) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.account_balance_wallet_outlined, size: 16, color: AppColors.primary),
              SizedBox(width: 8),
              Text(
                'Commercial Deduction Transparency',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildBreakdownRow('Total Proposed Gross', summary.formattedTotalGross, isBold: true),
          const Divider(color: AppColors.glassBorder, height: 16),
          _buildBreakdownRow('Platform Service Fee', '- ${summary.formattedTotalPlatformFee}', isDeduction: true),
          const SizedBox(height: 6),
          _buildBreakdownRow('Withholding Tax (TDS)', '- ${summary.formattedTotalWithholdingTax}', isDeduction: true),
          const SizedBox(height: 6),
          _buildBreakdownRow('Total Recorded Deductions', '- ${summary.formattedTotalDeductions}', isDeduction: true, isBold: true),
          const Divider(color: AppColors.glassBorder, height: 16),
          _buildBreakdownRow(
            'Net Disbursable Balance',
            summary.formattedNetDisbursable,
            isBold: true,
            highlightColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownRow(
    String label,
    String value, {
    bool isDeduction = false,
    bool isBold = false,
    Color? highlightColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.w600 : FontWeight.normal,
              color: isDeduction ? AppColors.textSecondary : AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: highlightColor ?? (isDeduction ? const Color(0xFFF87171) : AppColors.textPrimary),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'key': 'all', 'label': 'All Statements'},
      {'key': 'pending_approval', 'label': 'Pending'},
      {'key': 'approved', 'label': 'Approved'},
      {'key': 'paid', 'label': 'Paid'},
      {'key': 'rejected', 'label': 'Rejected'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((f) {
          final isSelected = _selectedFilter == f['key'];
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(
                f['label']!,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.black : AppColors.textSecondary,
                ),
              ),
              selected: isSelected,
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.glassBorder,
                ),
              ),
              onSelected: (_) => _onFilterChanged(f['key']!),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSettlementsSection(List<VendorSettlementItemModel> settlements) {
    if (settlements.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        alignment: Alignment.center,
        child: Column(
          children: [
            Icon(Icons.receipt_long_rounded, size: 56, color: AppColors.textSecondary.withValues(alpha: 0.4)),
            const SizedBox(height: 16),
            const Text(
              'No Settlement Statements Found',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _selectedFilter == 'all'
                  ? 'Settlement proposals created for completed services will appear in this ledger.'
                  : 'No statements found with status "${_selectedFilter.replaceAll('_', ' ')}".',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'PROPOSALS & STATEMENT LEDGER',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.2,
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              '${settlements.length} items',
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...settlements.map((s) => _buildSettlementCard(s)),
      ],
    );
  }

  Widget _buildSettlementCard(VendorSettlementItemModel item) {
    final statusColor = _resolveStatusColor(item.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _showStatementDetailModal(item),
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Ref & Status Badge
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    Text(
                      item.proposalReference.isNotEmpty ? item.proposalReference : item.settlementId,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        item.statusDisplayLabel,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Event & Service Context
                Text(
                  item.eventTitle ?? 'Event Booking #${item.eventId}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (item.serviceId != null && item.serviceId!.isNotEmpty)
                  Text(
                    'Service: ${item.serviceId}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),

                const SizedBox(height: 10),
                const Divider(color: AppColors.glassBorder, height: 1),
                const SizedBox(height: 10),

                // Financial Breakdown Row
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Gross Proposed', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                        Text(item.formattedGross, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Deductions', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                        Text('- ${item.formattedDeductions}', style: const TextStyle(fontSize: 12, color: Color(0xFFF87171))),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Net Statement', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                        Text(
                          item.formattedNet,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item.proposedAt != null
                          ? 'Date: ${DateFormat('dd MMM yyyy, hh:mm a').format(item.proposedAt!)}'
                          : '',
                      style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                    ),
                    const Row(
                      children: [
                        Text('Details', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.bold)),
                        SizedBox(width: 2),
                        Icon(Icons.chevron_right_rounded, size: 14, color: AppColors.primary),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showStatementDetailModal(VendorSettlementItemModel item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            border: Border(top: BorderSide(color: AppColors.glassBorder)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                height: 4,
                width: 40,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Title
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Statement #${item.proposalReference.isNotEmpty ? item.proposalReference : item.settlementId}',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            item.eventTitle ?? 'Event #${item.eventId}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(color: AppColors.glassBorder, height: 1),

              // Content
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(18),
                  children: [
                    // Status description box
                    _buildStatusDetailBox(item),
                    const SizedBox(height: 16),

                    // Financial Statement
                    const Text(
                      'FINANCIAL STATEMENT BREAKDOWN',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.1,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildBreakdownDetails(item),

                    const SizedBox(height: 16),
                    // Accounting Context & Identifiers
                    const Text(
                      'PROVENANCE & LEDGER IDENTIFIERS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.1,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildProvenanceDetails(item),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatusDetailBox(VendorSettlementItemModel item) {
    final statusColor = _resolveStatusColor(item.status);

    if (item.isRejected) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.error.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.cancel_outlined, size: 16, color: AppColors.error),
                SizedBox(width: 8),
                Text(
                  'Proposal Rejected / Adjustment Required',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.error),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              item.rejectionReason ?? 'No rejection reason specified.',
              style: const TextStyle(fontSize: 11, color: AppColors.textPrimary),
            ),
          ],
        ),
      );
    }

    if (item.isPaid) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.check_circle_outline_rounded, size: 16, color: Color(0xFF10B981)),
                SizedBox(width: 8),
                Text(
                  'Manual Ledger Reconciliation Recorded',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (item.payoutReference != null)
              Text(
                'Accounting Reference: ${item.payoutReference}',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
            if (item.reconciliationEvidence != null)
              Padding(
                padding: const EdgeInsets.only(top: 4.0),
                child: Text(
                  'Evidence: ${item.reconciliationEvidence}',
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ),
            const SizedBox(height: 6),
            const Text(
              'Notice: This entry confirms internal ledger reconciliation. It does not represent an automated electronic bank transfer.',
              style: TextStyle(fontSize: 10, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
            ),
          ],
        ),
      );
    }

    if (item.isApproved) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.accentBlue.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.accentBlue.withValues(alpha: 0.4)),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.verified_user_rounded, size: 16, color: AppColors.accentBlue),
                SizedBox(width: 8),
                Text(
                  'Approved — Disbursement Gateway Unconfigured',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accentBlue),
                ),
              ],
            ),
            SizedBox(height: 6),
            Text(
              'This settlement proposal has been administratively verified and approved. Electronic bank disbursement remains unconfigured (payout_not_configured).',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Text(
        'Proposal is currently under administrative audit and review.',
        style: TextStyle(fontSize: 11, color: statusColor),
      ),
    );
  }

  Widget _buildBreakdownDetails(VendorSettlementItemModel item) {
    final breakdown = item.calculationBreakdown;

    if (breakdown == null || !breakdown.isAvailable) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surfaceLighter,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          children: [
            const Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: AppColors.textSecondary),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Detailed calculation breakdown unavailable for this record.',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _buildModalRow('Gross Amount', item.formattedGross),
            const SizedBox(height: 4),
            _buildModalRow('Net Statement Amount', item.formattedNet, isBold: true),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          _buildModalRow('Gross Proposed', breakdown.formattedGross),
          const Divider(color: AppColors.glassBorder, height: 14),
          _buildModalRow('Platform Service Fee', '- ${breakdown.formattedPlatformFee}', isDeduction: true),
          const SizedBox(height: 6),
          _buildModalRow('Withholding Tax (TDS)', '- ${breakdown.formattedWithholdingTax}', isDeduction: true),
          const Divider(color: AppColors.glassBorder, height: 14),
          _buildModalRow(
            'Net Payable Amount',
            breakdown.formattedNet,
            isBold: true,
            highlightColor: AppColors.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildProvenanceDetails(VendorSettlementItemModel item) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          _buildModalRow('Proposal Reference', item.proposalReference.isNotEmpty ? item.proposalReference : 'N/A'),
          const SizedBox(height: 6),
          _buildModalRow('Settlement ID', item.settlementId),
          const SizedBox(height: 6),
          _buildModalRow('Event Reference', item.eventId),
          const SizedBox(height: 6),
          _buildModalRow('Allocation Reference', item.allocationId),
          if (item.bookingId != null && item.bookingId!.isNotEmpty) ...[
            const SizedBox(height: 6),
            _buildModalRow('Booking Reference', item.bookingId!),
          ],
          const SizedBox(height: 6),
          _buildModalRow(
            'Proposed Timestamp',
            item.proposedAt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(item.proposedAt!) : 'N/A',
          ),
          if (item.approvedAt != null) ...[
            const SizedBox(height: 6),
            _buildModalRow('Approved Timestamp', DateFormat('dd MMM yyyy, hh:mm a').format(item.approvedAt!)),
          ],
          if (item.reconciledAt != null) ...[
            const SizedBox(height: 6),
            _buildModalRow('Reconciled Timestamp', DateFormat('dd MMM yyyy, hh:mm a').format(item.reconciledAt!)),
          ],
          if (item.rejectedAt != null) ...[
            const SizedBox(height: 6),
            _buildModalRow('Rejected Timestamp', DateFormat('dd MMM yyyy, hh:mm a').format(item.rejectedAt!)),
          ],
        ],
      ),
    );
  }

  Widget _buildModalRow(
    String label,
    String value, {
    bool isBold = false,
    bool isDeduction = false,
    Color? highlightColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
            color: highlightColor ?? (isDeduction ? const Color(0xFFF87171) : AppColors.textPrimary),
          ),
        ),
      ],
    );
  }

  Color _resolveStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'pending_approval':
        return const Color(0xFFF59E0B); // Amber
      case 'approved':
        return AppColors.accentBlue;
      case 'paid':
        return const Color(0xFF10B981); // Emerald
      case 'rejected':
      case 'cancelled':
        return AppColors.error;
      default:
        return AppColors.textSecondary;
    }
  }
}
