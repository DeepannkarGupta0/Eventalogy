import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_colors.dart';
import '../../models/settlements_model.dart';
import '../../services/settlement_api_service.dart';

class AdminSettlementsTab extends StatefulWidget {
  final SettlementApiService? apiService;

  const AdminSettlementsTab({super.key, this.apiService});

  @override
  State<AdminSettlementsTab> createState() => _AdminSettlementsTabState();
}

class _AdminSettlementsTabState extends State<AdminSettlementsTab> {
  late final SettlementApiService _api;

  // View Mode: 0 = Proposals Ledger, 1 = Eligibility Queue
  int _selectedTabIndex = 0;

  // Proposals State
  bool _isLoading = false;
  String? _errorMessage;
  List<SettlementModel> _settlements = [];
  String _searchQuery = '';
  String _statusFilter = 'All';

  // Eligibility Queue State
  bool _isLoadingAllocations = false;
  String? _allocationsError;
  List<EligibleAllocationModel> _eligibleAllocations = [];
  String _allocationSearchQuery = '';
  String _allocationFilter = 'All'; // 'All', 'Eligible', 'Blocked'

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? SettlementApiService();
    _loadSettlements();
    _loadEligibleAllocations();
  }

  Future<void> _loadSettlements() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final items = await _api.fetchSettlements(
        status: _statusFilter != 'All' ? _statusFilter : null,
      );
      if (mounted) {
        setState(() {
          _settlements = items;
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

  Future<void> _loadEligibleAllocations() async {
    setState(() {
      _isLoadingAllocations = true;
      _allocationsError = null;
    });

    try {
      final items = await _api.fetchEligibleAllocations();
      if (mounted) {
        setState(() {
          _eligibleAllocations = items;
          _isLoadingAllocations = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _allocationsError = e.toString().replaceAll('Exception: ', '');
          _isLoadingAllocations = false;
        });
      }
    }
  }

  List<SettlementModel> get _filteredSettlements {
    var list = _settlements;
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      list = list.where((s) {
        return s.settlementId.toLowerCase().contains(q) ||
            s.proposalReference.toLowerCase().contains(q) ||
            s.vendorId.toLowerCase().contains(q) ||
            s.eventId.toLowerCase().contains(q) ||
            s.paymentId.toLowerCase().contains(q);
      }).toList();
    }
    if (_statusFilter != 'All') {
      list = list.where((s) => s.status.toLowerCase() == _statusFilter.toLowerCase()).toList();
    }
    return list;
  }

  List<EligibleAllocationModel> get _filteredAllocations {
    var list = _eligibleAllocations;
    if (_allocationSearchQuery.isNotEmpty) {
      final q = _allocationSearchQuery.toLowerCase();
      list = list.where((a) {
        return a.allocationId.toLowerCase().contains(q) ||
            a.eventId.toLowerCase().contains(q) ||
            (a.eventTitle?.toLowerCase().contains(q) ?? false) ||
            a.vendorId.toLowerCase().contains(q) ||
            (a.vendorName?.toLowerCase().contains(q) ?? false) ||
            (a.bookingId?.toLowerCase().contains(q) ?? false);
      }).toList();
    }
    if (_allocationFilter == 'Eligible') {
      list = list.where((a) => a.isEligible).toList();
    } else if (_allocationFilter == 'Blocked') {
      list = list.where((a) => !a.isEligible).toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildViewModeToggle(),
        _buildHeaderControls(),
        if (_selectedTabIndex == 0) _buildKpisSummary(),
        Expanded(
          child: _selectedTabIndex == 0
              ? _buildProposalsBody()
              : _buildEligibleAllocationsBody(),
        ),
      ],
    );
  }

  Widget _buildViewModeToggle() {
    final readyCount = _eligibleAllocations.where((a) => a.isEligible).length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              key: const Key('tab_proposals_ledger'),
              icon: Icon(
                Icons.receipt_long,
                size: 18,
                color: _selectedTabIndex == 0 ? AppColors.primary : AppColors.textSecondary,
              ),
              label: Text(
                'Proposals Ledger (${_settlements.length})',
                style: TextStyle(
                  fontWeight: _selectedTabIndex == 0 ? FontWeight.bold : FontWeight.normal,
                  color: _selectedTabIndex == 0 ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
              style: OutlinedButton.styleFrom(
                backgroundColor: _selectedTabIndex == 0
                    ? AppColors.primary.withValues(alpha: 0.12)
                    : Colors.transparent,
                side: BorderSide(
                  color: _selectedTabIndex == 0 ? AppColors.primary : AppColors.glassBorder,
                  width: _selectedTabIndex == 0 ? 1.5 : 1.0,
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: () => setState(() => _selectedTabIndex = 0),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              key: const Key('tab_eligibility_queue'),
              icon: Icon(
                Icons.rule_folder_outlined,
                size: 18,
                color: _selectedTabIndex == 1 ? AppColors.accentBlue : AppColors.textSecondary,
              ),
              label: Text(
                'Eligibility Queue ($readyCount Ready)',
                style: TextStyle(
                  fontWeight: _selectedTabIndex == 1 ? FontWeight.bold : FontWeight.normal,
                  color: _selectedTabIndex == 1 ? AppColors.accentBlue : AppColors.textSecondary,
                ),
              ),
              style: OutlinedButton.styleFrom(
                backgroundColor: _selectedTabIndex == 1
                    ? AppColors.accentBlue.withValues(alpha: 0.12)
                    : Colors.transparent,
                side: BorderSide(
                  color: _selectedTabIndex == 1 ? AppColors.accentBlue : AppColors.glassBorder,
                  width: _selectedTabIndex == 1 ? 1.5 : 1.0,
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: () => setState(() => _selectedTabIndex = 1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderControls() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        children: [
          if (_selectedTabIndex == 0) ...[
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    key: const Key('settlements_search_field'),
                    decoration: const InputDecoration(
                      hintText: 'Search by Settlement ID, Vendor, Event, Ref...',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    onChanged: (val) => setState(() => _searchQuery = val),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: const Key('settlements_status_filter_dropdown'),
                    isExpanded: true,
                    initialValue: _statusFilter,
                    decoration: const InputDecoration(
                      labelText: 'Status Filter',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: [
                      'All',
                      'pending_approval',
                      'approved',
                      'paid',
                      'rejected',
                      'reversed',
                      'cancelled'
                    ]
                        .map((e) => DropdownMenuItem(
                              value: e,
                              child: Text(
                                e == 'All' ? 'All Statuses' : e.toUpperCase().replaceAll('_', ' '),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _statusFilter = val);
                        _loadSettlements();
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  key: const Key('settlements_refresh_button'),
                  icon: const Icon(Icons.refresh, color: AppColors.primary),
                  tooltip: 'Refresh Ledger',
                  onPressed: _isLoading ? null : _loadSettlements,
                ),
              ],
            ),
            const SizedBox(height: 8),
            _buildDisbursementDisclaimerBanner(),
          ] else ...[
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    key: const Key('allocations_search_field'),
                    decoration: const InputDecoration(
                      hintText: 'Search by Allocation ID, Event, Vendor, Booking...',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    onChanged: (val) => setState(() => _allocationSearchQuery = val),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: const Key('allocations_filter_dropdown'),
                    isExpanded: true,
                    initialValue: _allocationFilter,
                    decoration: const InputDecoration(
                      labelText: 'Review Filter',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: ['All', 'Eligible', 'Blocked']
                        .map((e) => DropdownMenuItem(
                              value: e,
                              child: Text(
                                e == 'All'
                                    ? 'All Allocations'
                                    : (e == 'Eligible' ? 'Eligible For Review' : 'Blocked / Pending'),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _allocationFilter = val);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  key: const Key('allocations_refresh_button'),
                  icon: const Icon(Icons.refresh, color: AppColors.accentBlue),
                  tooltip: 'Refresh Queue',
                  onPressed: _isLoadingAllocations ? null : _loadEligibleAllocations,
                ),
              ],
            ),
            const SizedBox(height: 8),
            _buildEligibilityQueueDisclaimerBanner(),
          ],
        ],
      ),
    );
  }

  Widget _buildDisbursementDisclaimerBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: Colors.amber, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'DISBURSEMENT NOTICE: Automated real-money transfers are strictly disabled (payout_not_configured). Approval reserves accounting balances on the ledger; "PAID" status requires explicit manual reconciliation.',
              style: TextStyle(color: Colors.amber.shade200, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEligibilityQueueDisclaimerBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.accentBlue.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_user_outlined, color: AppColors.accentBlue, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'ELIGIBILITY QUEUE: Allocations require administrative service delivery completion approval and confirmed customer payment before a settlement proposal can be drafted.',
              style: TextStyle(color: Colors.lightBlue.shade200, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpisSummary() {
    final pendingItems = _settlements.where((s) => s.isPendingApproval);
    final approvedItems = _settlements.where((s) => s.isApproved);
    final paidItems = _settlements.where((s) => s.isPaid);

    final pendingGross = pendingItems.fold<int>(0, (sum, s) => sum + s.grossAmountPaise);
    final approvedNet = approvedItems.fold<int>(0, (sum, s) => sum + s.netAmountPaise);
    final paidNet = paidItems.fold<int>(0, (sum, s) => sum + s.netAmountPaise);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
      child: LayoutBuilder(builder: (context, constraints) {
        final isWide = constraints.maxWidth > 700;
        final cards = [
          _buildKpiCard('Total Proposals', '${_settlements.length}', Colors.grey),
          _buildKpiCard(
            'Pending Approval',
            '${pendingItems.length} (₹${(pendingGross / 100).toStringAsFixed(0)})',
            Colors.amber,
          ),
          _buildKpiCard(
            'Approved (Payout Blocked)',
            '${approvedItems.length} (₹${(approvedNet / 100).toStringAsFixed(0)})',
            AppColors.accentBlue,
          ),
          _buildKpiCard(
            'Reconciled Paid',
            '${paidItems.length} (₹${(paidNet / 100).toStringAsFixed(0)})',
            Colors.green,
          ),
        ];

        if (isWide) {
          return Row(
            children: cards.map((c) => Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: c))).toList(),
          );
        } else {
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: cards.map((c) => SizedBox(width: (constraints.maxWidth - 24) / 2, child: c)).toList(),
          );
        }
      }),
    );
  }

  Widget _buildKpiCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildProposalsBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(key: Key('settlements_loading')),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(
                'Failed to load settlements: $_errorMessage',
                key: const Key('settlements_error'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textPrimary),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                onPressed: _loadSettlements,
              ),
            ],
          ),
        ),
      );
    }

    final items = _filteredSettlements;
    if (items.isEmpty) {
      return const Center(
        child: Text(
          'No settlements found.',
          key: Key('settlements_empty'),
          style: TextStyle(color: AppColors.textSecondary),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        return _buildSettlementCard(items[index]);
      },
    );
  }

  Widget _buildEligibleAllocationsBody() {
    if (_isLoadingAllocations) {
      return const Center(
        child: CircularProgressIndicator(key: Key('allocations_loading')),
      );
    }

    if (_allocationsError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(
                'Failed to load allocations: $_allocationsError',
                key: const Key('allocations_error'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textPrimary),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                onPressed: _loadEligibleAllocations,
              ),
            ],
          ),
        ),
      );
    }

    final items = _filteredAllocations;
    if (items.isEmpty) {
      return const Center(
        child: Text(
          'No allocations found in review queue.',
          key: Key('allocations_empty'),
          style: TextStyle(color: AppColors.textSecondary),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        return _buildAllocationCard(items[index]);
      },
    );
  }

  Widget _buildAllocationCard(EligibleAllocationModel item) {
    final statusColor = item.isEligible ? Colors.green : Colors.amber;

    return Card(
      key: Key('eligible_allocation_card_${item.allocationId}'),
      margin: const EdgeInsets.only(bottom: 14),
      color: AppColors.surfaceLighter,
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      Text(
                        'Allocation: ${item.allocationId}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Container(
                        key: Key(item.isEligible
                            ? 'eligibility_badge_eligible_${item.allocationId}'
                            : 'eligibility_badge_blocked_${item.allocationId}'),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: statusColor.withValues(alpha: 0.6)),
                        ),
                        child: Text(
                          item.isEligible ? 'ELIGIBLE FOR REVIEW' : 'BLOCKED',
                          style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  item.formattedRemaining,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Vendor: ${item.vendorName ?? item.vendorId}  |  Event: ${item.eventTitle ?? item.eventId}',
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Text(
              'Contracted: ${item.formattedContracted}  |  Committed: ${item.formattedCommitted}  |  Booking: ${item.bookingId ?? "Direct"}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                _buildMiniBadge(
                  'Fulfillment: ${item.fulfillmentStatus.toUpperCase()}',
                  item.isFulfillmentCompleted ? Colors.green : Colors.amber,
                ),
                _buildMiniBadge(
                  'Payment: ${item.paymentStatus.toUpperCase()}',
                  item.isPaymentPaid ? Colors.green : Colors.red,
                ),
              ],
            ),
            if (!item.isEligible && item.blockedReason != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.lock_clock, color: Colors.amber, size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Reason: ${item.blockedReason!}',
                        style: const TextStyle(color: Colors.amber, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const Divider(height: 20, color: AppColors.glassBorder),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (item.isEligible) ...[
                  ElevatedButton.icon(
                    key: Key('propose_settlement_button_${item.allocationId}'),
                    icon: const Icon(Icons.playlist_add, size: 16),
                    label: const Text('Propose Settlement'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                    ),
                    onPressed: _isSubmitting ? null : () => _showProposeSettlementDialog(item),
                  ),
                ] else ...[
                  Text(
                    'Requires completion approval & captured payment',
                    style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        text,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildSettlementCard(SettlementModel item) {
    Color statusColor;
    switch (item.status.toLowerCase()) {
      case 'approved':
        statusColor = AppColors.accentBlue;
        break;
      case 'paid':
        statusColor = Colors.green;
        break;
      case 'rejected':
      case 'cancelled':
        statusColor = AppColors.error;
        break;
      case 'reversed':
        statusColor = AppColors.accentPurple;
        break;
      case 'pending_approval':
      default:
        statusColor = Colors.amber;
    }

    return Card(
      key: Key('settlement_card_${item.settlementId}'),
      margin: const EdgeInsets.only(bottom: 14),
      color: AppColors.surfaceLighter,
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      Text(
                        'ID: ${item.settlementId}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: statusColor.withValues(alpha: 0.6)),
                        ),
                        child: Text(
                          item.statusDisplayLabel.toUpperCase(),
                          style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  item.formattedNet,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primary),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (item.isPayoutBlocked) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.red.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.block, color: Colors.redAccent, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      'Disbursement Blocked: ${item.disbursementBlockedReason ?? "Payout provider unconfigured"}',
                      style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
            Text(
              'Gross Contracted: ${item.formattedGross}  |  Platform Fee: ${item.formattedPlatformFee}  |  Deductions: ${item.formattedDeductions}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 4),
            Text(
              'Vendor: ${item.vendorId}  |  Event: ${item.eventId}  |  Ref: ${item.proposalReference}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            if (item.payoutReference != null) ...[
              const SizedBox(height: 4),
              Text(
                'Manual UTR/Ref: ${item.payoutReference} (Evidence: ${item.reconciliationEvidence ?? "Recorded"})',
                style: const TextStyle(color: Colors.greenAccent, fontSize: 12),
              ),
            ],
            if (item.rejectionReason != null) ...[
              const SizedBox(height: 4),
              Text(
                'Rejection Reason: ${item.rejectionReason}',
                style: const TextStyle(color: AppColors.error, fontSize: 12),
              ),
            ],
            const Divider(height: 20, color: AppColors.glassBorder),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  icon: const Icon(Icons.visibility_outlined, size: 16),
                  label: const Text('Details & Audit'),
                  onPressed: () => _showDetailDialog(item),
                ),
                if (item.isPendingApproval) ...[
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    key: Key('reject_button_${item.settlementId}'),
                    icon: const Icon(Icons.close, color: AppColors.error, size: 16),
                    label: const Text('Reject', style: TextStyle(color: AppColors.error)),
                    onPressed: _isSubmitting ? null : () => _showRejectDialog(item),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    key: Key('approve_button_${item.settlementId}'),
                    icon: const Icon(Icons.check, size: 16),
                    label: const Text('Approve'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                    onPressed: _isSubmitting ? null : () => _confirmApproval(item),
                  ),
                ],
                if (item.isApproved) ...[
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    key: Key('reconcile_button_${item.settlementId}'),
                    icon: const Icon(Icons.verified_outlined, size: 16),
                    label: const Text('Manual Reconcile'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.teal, foregroundColor: Colors.white),
                    onPressed: _isSubmitting ? null : () => _showReconcileDialog(item),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showDetailDialog(SettlementModel item) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Settlement Detail: ${item.settlementId}'),
          content: SizedBox(
            width: 550,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _detailSection('Financial Breakdown', [
                    _detailRow('Gross Contracted Amount', item.formattedGross),
                    _detailRow('Platform Fee BPS', '${item.calculationInputs.platformFeeBps} bps (${(item.calculationInputs.platformFeeBps / 100.0).toStringAsFixed(1)}%)'),
                    _detailRow('Platform Fee Amount', item.formattedPlatformFee),
                    _detailRow('Withholding Tax BPS', '${item.calculationInputs.withholdingTaxBps} bps (${(item.calculationInputs.withholdingTaxBps / 100.0).toStringAsFixed(1)}%)'),
                    _detailRow('Withholding Tax Amount', item.formattedWithholdingTax),
                    _detailRow('Total Deductions', item.formattedDeductions),
                    _detailRow('Net Proposed Payable', item.formattedNet, isBold: true, color: AppColors.primary),
                  ]),
                  const SizedBox(height: 12),
                  _detailSection('Disbursement Rail & Policy', [
                    _detailRow('Disbursement Status', item.disbursementStatus ?? 'payout_not_configured'),
                    if (item.disbursementBlockedReason != null)
                      _detailRow('Disbursement Blocked Reason', item.disbursementBlockedReason!),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 4.0),
                      child: Text(
                        'Policy Boundary: Real money disbursement is blocked. The platform operates an internal accounting ledger; approvals do not initiate external bank wire transfers.',
                        style: TextStyle(color: Colors.amber, fontSize: 11),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  _detailSection('Entity Provenance', [
                    _detailRow('Vendor ID', item.vendorId),
                    _detailRow('Event ID', item.eventId),
                    if (item.bookingId != null) _detailRow('Booking ID', item.bookingId!),
                    _detailRow('Payment ID', item.paymentId),
                    _detailRow('Proposal Reference', item.proposalReference),
                    if (item.resubmittedFromSettlementId != null)
                      _detailRow('Resubmitted From', item.resubmittedFromSettlementId!),
                    _detailRow('Proposed By', item.proposedBy),
                    if (item.proposedAt != null)
                      _detailRow('Proposed At', DateFormat.yMd().add_Hms().format(item.proposedAt!)),
                    if (item.approvedBy != null) _detailRow('Approved By', item.approvedBy!),
                    if (item.approvedAt != null)
                      _detailRow('Approved At', DateFormat.yMd().add_Hms().format(item.approvedAt!)),
                    if (item.rejectedBy != null) _detailRow('Rejected By', item.rejectedBy!),
                    if (item.rejectedAt != null)
                      _detailRow('Rejected At', DateFormat.yMd().add_Hms().format(item.rejectedAt!)),
                    if (item.rejectionReason != null)
                      _detailRow('Rejection Reason', item.rejectionReason!, color: AppColors.error),
                  ]),
                  if (item.payoutReference != null) ...[
                    const SizedBox(height: 12),
                    _detailSection('Reconciliation Evidence', [
                      _detailRow('Payout Reference (UTR)', item.payoutReference!),
                      _detailRow('Reconciliation Evidence', item.reconciliationEvidence ?? 'None'),
                      _detailRow('Reconciliation Type', item.reconciliationType ?? 'manual_ledger'),
                      if (item.reconciledBy != null) _detailRow('Reconciled By', item.reconciledBy!),
                      if (item.reconciledAt != null)
                        _detailRow('Reconciled At', DateFormat.yMd().add_Hms().format(item.reconciledAt!)),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 4.0),
                        child: Text(
                          'Disclaimer: Manual ledger reconciliation record logged by administrator. Does not represent automated partner banking validation.',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                      ),
                    ]),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  Widget _detailSection(String title, List<Widget> rows) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryLight)),
          const Divider(color: AppColors.glassBorder),
          ...rows,
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
                color: color ?? AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showProposeSettlementDialog(EligibleAllocationModel allocation) {
    final messenger = ScaffoldMessenger.of(context);
    int selectedFeeBps = 1000; // 10%
    int selectedTaxBps = 0; // 0%
    bool isCustomFee = false;
    bool isCustomTax = false;
    bool policyConfirmed = false;

    final grossController = TextEditingController(
      text: allocation.remainingEligibleINR.toStringAsFixed(2),
    );
    final customFeeController = TextEditingController(text: '1000');
    final customTaxController = TextEditingController(text: '0');
    final notesController = TextEditingController(text: 'STANDARD_PLATFORM_FEE_10_PERCENT');

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(builder: (context, setDialogState) {
          final grossRupees = double.tryParse(grossController.text) ?? 0.0;
          final grossPaise = (grossRupees * 100).round();

          final effectiveFeeBps = isCustomFee
              ? (int.tryParse(customFeeController.text) ?? 0)
              : selectedFeeBps;
          final effectiveTaxBps = isCustomTax
              ? (int.tryParse(customTaxController.text) ?? 0)
              : selectedTaxBps;

          final platformFeePaise = ((grossPaise * effectiveFeeBps) / 10000).round();
          final withholdingTaxPaise = ((grossPaise * effectiveTaxBps) / 10000).round();
          final deductionsPaise = platformFeePaise + withholdingTaxPaise;
          final netAmountPaise = grossPaise - deductionsPaise;

          final isValidAmount = grossPaise > 0 && grossPaise <= allocation.remainingEligiblePaise;
          final isValidFee = effectiveFeeBps >= 0 && effectiveFeeBps <= 10000;
          final isValidTax = effectiveTaxBps >= 0 && effectiveTaxBps <= 10000;
          final canSubmit = policyConfirmed && isValidAmount && isValidFee && isValidTax && netAmountPaise >= 0;

          return AlertDialog(
            title: Text('Propose Settlement: ${allocation.allocationId}'),
            content: SizedBox(
              width: 520,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Vendor: ${allocation.vendorName ?? allocation.vendorId}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text('Event: ${allocation.eventTitle ?? allocation.eventId}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          Text('Remaining Eligible Balance: ${allocation.formattedRemaining}', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      key: const Key('propose_gross_amount_input'),
                      controller: grossController,
                      decoration: const InputDecoration(
                        labelText: 'Proposed Gross Amount (₹) *',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      key: const Key('propose_platform_fee_dropdown'),
                      isExpanded: true,
                      initialValue: isCustomFee ? -1 : selectedFeeBps,
                      decoration: const InputDecoration(
                        labelText: 'Platform Fee Policy *',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: const [
                        DropdownMenuItem(value: 1000, child: Text('Standard Platform Rate: 10% (1000 bps)')),
                        DropdownMenuItem(value: 500, child: Text('Early Partner Rate: 5% (500 bps)')),
                        DropdownMenuItem(value: 800, child: Text('Preferred Vendor Tier: 8% (800 bps)')),
                        DropdownMenuItem(value: -1, child: Text('Custom Basis Points (bps)')),
                      ],
                      onChanged: (val) {
                        setDialogState(() {
                          if (val == -1) {
                            isCustomFee = true;
                          } else {
                            isCustomFee = false;
                            selectedFeeBps = val ?? 1000;
                            notesController.text = val == 1000
                                ? 'STANDARD_PLATFORM_FEE_10_PERCENT'
                                : (val == 500 ? 'EARLY_PARTNER_FEE_5_PERCENT' : 'PREFERRED_VENDOR_FEE_8_PERCENT');
                          }
                        });
                      },
                    ),
                    if (isCustomFee) ...[
                      const SizedBox(height: 8),
                      TextFormField(
                        key: const Key('propose_custom_fee_input'),
                        controller: customFeeController,
                        decoration: const InputDecoration(
                          labelText: 'Custom Platform Fee (bps: 0 - 10000) *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (_) => setDialogState(() {}),
                      ),
                    ],
                    const SizedBox(height: 12),
                    DropdownButtonFormField<int>(
                      key: const Key('propose_withholding_tax_dropdown'),
                      isExpanded: true,
                      initialValue: isCustomTax ? -1 : selectedTaxBps,
                      decoration: const InputDecoration(
                        labelText: 'Withholding Tax / Deductions *',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: const [
                        DropdownMenuItem(value: 0, child: Text('No Withholding: 0% (0 bps)')),
                        DropdownMenuItem(value: 100, child: Text('Standard TDS: 1% (100 bps)')),
                        DropdownMenuItem(value: 200, child: Text('Standard TDS: 2% (200 bps)')),
                        DropdownMenuItem(value: -1, child: Text('Custom Basis Points (bps)')),
                      ],
                      onChanged: (val) {
                        setDialogState(() {
                          if (val == -1) {
                            isCustomTax = true;
                          } else {
                            isCustomTax = false;
                            selectedTaxBps = val ?? 0;
                          }
                        });
                      },
                    ),
                    if (isCustomTax) ...[
                      const SizedBox(height: 8),
                      TextFormField(
                        key: const Key('propose_custom_tax_input'),
                        controller: customTaxController,
                        decoration: const InputDecoration(
                          labelText: 'Custom Withholding Tax (bps: 0 - 10000) *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (_) => setDialogState(() {}),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('propose_notes_input'),
                      controller: notesController,
                      decoration: const InputDecoration(
                        labelText: 'Policy Reference & Commercial Notes',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 14),
                    // Live Calculation Preview
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.glassBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Calculation Breakdown Preview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primaryLight)),
                          const Divider(color: AppColors.glassBorder),
                          _calcRow('Gross Amount', '₹${(grossPaise / 100).toStringAsFixed(2)}'),
                          _calcRow('Platform Fee ($effectiveFeeBps bps)', '₹${(platformFeePaise / 100).toStringAsFixed(2)}'),
                          _calcRow('Withholding Tax ($effectiveTaxBps bps)', '₹${(withholdingTaxPaise / 100).toStringAsFixed(2)}'),
                          _calcRow('Total Deductions', '₹${(deductionsPaise / 100).toStringAsFixed(2)}'),
                          const Divider(color: AppColors.glassBorder),
                          _calcRow('Net Amount Payable', '₹${(netAmountPaise / 100).toStringAsFixed(2)}', isBold: true, color: AppColors.primary),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    CheckboxListTile(
                      key: const Key('confirm_policy_checkbox'),
                      contentPadding: EdgeInsets.zero,
                      value: policyConfirmed,
                      title: const Text(
                        'I confirm this proposal adheres to verified commercial platform contracts and integer paise financial invariants.',
                        style: TextStyle(fontSize: 12),
                      ),
                      onChanged: (val) => setDialogState(() => policyConfirmed = val ?? false),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                key: const Key('confirm_propose_dialog_button'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                ),
                onPressed: canSubmit
                    ? () async {
                        Navigator.of(context).pop();
                        setState(() => _isSubmitting = true);
                        try {
                          await _api.proposeSettlement(
                            paymentId: allocation.paymentId ?? 'pay_auto_${allocation.eventId}',
                            allocationId: allocation.allocationId,
                            platformFeeBps: effectiveFeeBps,
                            withholdingTaxBps: effectiveTaxBps,
                            proposedAmountPaise: grossPaise,
                            notes: notesController.text.trim(),
                          );
                          if (mounted) {
                            messenger.showSnackBar(
                              SnackBar(content: Text('Settlement proposal created successfully for allocation ${allocation.allocationId}.')),
                            );
                          }
                          await _loadSettlements();
                          await _loadEligibleAllocations();
                          if (mounted) setState(() => _selectedTabIndex = 0);
                        } catch (e) {
                          if (mounted) {
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('Proposal failed: ${e.toString().replaceAll("Exception: ", "")}'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => _isSubmitting = false);
                        }
                      }
                    : null,
                child: const Text('Submit Proposal'),
              ),
            ],
          );
        });
      },
    );
  }

  Widget _calcRow(String label, String value, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: color ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  void _confirmApproval(SettlementModel item) {
    final messenger = ScaffoldMessenger.of(context);
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Confirm Settlement Approval'),
          content: Text(
            'Approve settlement of ${item.formattedNet} to vendor ${item.vendorId}?\n\n'
            'Notice: This transitions the proposal to "Approved — payout not configured" on the financial ledger. Real money is NOT automatically transferred.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              key: const Key('confirm_approval_dialog_button'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
              onPressed: () async {
                Navigator.of(context).pop();
                setState(() => _isSubmitting = true);
                try {
                  await _api.approveSettlement(item.settlementId);
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Settlement ${item.settlementId} successfully approved.')),
                    );
                  }
                  _loadSettlements();
                  _loadEligibleAllocations();
                } catch (e) {
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Approval failed: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isSubmitting = false);
                }
              },
              child: const Text('Approve Proposal'),
            ),
          ],
        );
      },
    );
  }

  void _showRejectDialog(SettlementModel item) {
    final messenger = ScaffoldMessenger.of(context);
    final reasonController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Reject Settlement Proposal'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Rejecting proposal ${item.settlementId} will release reserved balance back to allocation ${item.allocationId}.'),
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('reject_reason_input'),
                  controller: reasonController,
                  decoration: const InputDecoration(
                    labelText: 'Rejection Reason *',
                    hintText: 'e.g. Bank invoice mismatch, service quality dispute...',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Rejection reason is required.';
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              key: const Key('confirm_reject_dialog_button'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white),
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                final reason = reasonController.text.trim();
                Navigator.of(context).pop();
                setState(() => _isSubmitting = true);
                try {
                  await _api.rejectSettlement(item.settlementId, reason);
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Settlement ${item.settlementId} rejected and balance released.')),
                    );
                  }
                  _loadSettlements();
                  _loadEligibleAllocations();
                } catch (e) {
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Rejection failed: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isSubmitting = false);
                }
              },
              child: const Text('Reject & Release'),
            ),
          ],
        );
      },
    );
  }

  void _showReconcileDialog(SettlementModel item) {
    final messenger = ScaffoldMessenger.of(context);
    final refController = TextEditingController();
    final evidenceController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Manual Reconciliation Gating'),
          content: Form(
            key: formKey,
            child: SizedBox(
              width: 480,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                      ),
                      child: const Text(
                        'Notice: Entering external payout confirmation marks funds as "Manual Ledger Reconciliation Recorded" on Eventalogy internal ledger. This is an administrative manual reconciliation and does NOT constitute independent gateway verification or bank transfer proof.',
                        style: TextStyle(color: Colors.amber, fontSize: 11),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('reconcile_reference_input'),
                      controller: refController,
                      decoration: const InputDecoration(
                        labelText: 'External Payout Reference (UTR / Trans ID) *',
                        hintText: 'e.g. UTR_HDFC_20261028_123456',
                        border: OutlineInputBorder(),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().length < 6) {
                          return 'Reference must be at least 6 characters.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('reconcile_evidence_input'),
                      controller: evidenceController,
                      decoration: const InputDecoration(
                        labelText: 'Reconciliation Evidence & Audit Source *',
                        hintText: 'e.g. Bank statement advice verified in nodal portal...',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 2,
                      validator: (val) {
                        if (val == null || val.trim().length < 10) {
                          return 'Evidence must be substantive (at least 10 chars).';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              key: const Key('confirm_reconcile_dialog_button'),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.teal, foregroundColor: Colors.white),
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                final ref = refController.text.trim();
                final evidence = evidenceController.text.trim();
                Navigator.of(context).pop();
                setState(() => _isSubmitting = true);
                try {
                  await _api.reconcileSettlement(
                    item.settlementId,
                    payoutReference: ref,
                    reconciliationEvidence: evidence,
                  );
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Settlement ${item.settlementId} reconciled to PAID (Manual Ledger Reconciliation Recorded).')),
                    );
                  }
                  _loadSettlements();
                  _loadEligibleAllocations();
                } catch (e) {
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(content: Text('Reconciliation failed: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
                    );
                  }
                } finally {
                  if (mounted) setState(() => _isSubmitting = false);
                }
              },
              child: const Text('Reconcile as Paid'),
            ),
          ],
        );
      },
    );
  }
}
