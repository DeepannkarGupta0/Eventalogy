import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../models/rfq_model.dart';
import '../../../../services/rfq_api_service.dart';
import '../widgets/decline_rfq_dialog.dart';
import '../widgets/payment_milestone_timeline_widget.dart';
import '../widgets/rfq_package_card.dart';

class EventProcurementScreen extends StatefulWidget {
  final String workflowId;
  final String? eventName;
  final String? rfqBatchId;
  final RfqApiService? apiService;

  const EventProcurementScreen({
    super.key,
    required this.workflowId,
    this.eventName,
    this.rfqBatchId,
    this.apiService,
  });

  @override
  State<EventProcurementScreen> createState() => _EventProcurementScreenState();
}

class _EventProcurementScreenState extends State<EventProcurementScreen> {
  late final RfqApiService _apiService;
  bool _isLoading = true;
  bool _isProcessingAction = false;
  String? _errorMessage;
  List<RfqPackageModel> _packages = [];
  String _selectedCategory = 'ALL';
  String _selectedStatus = 'ALL';
  bool _showTimeline = true;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? RfqApiService();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final pkgs = await _apiService.getPackagesByWorkflow(widget.workflowId);
      if (mounted) {
        setState(() {
          _packages = pkgs;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  List<RfqPackageModel> get _filteredPackages {
    return _packages.where((pkg) {
      final matchesCategory = _selectedCategory == 'ALL' ||
          pkg.category.toLowerCase() == _selectedCategory.toLowerCase();

      final matchesStatus = switch (_selectedStatus) {
        'quoted' => pkg.status == 'quoted',
        'accepted' => pkg.status == 'accepted',
        'pending' => !pkg.isTerminal,
        _ => true,
      };

      return matchesCategory && matchesStatus;
    }).toList();
  }

  int get _totalEstimatedCostPaise =>
      _packages.fold(0, (acc, p) => acc + p.estimatedTotalPaise);

  int get _totalApprovedCostPaise => _packages
      .where((p) => p.status == 'accepted')
      .fold(0, (acc, p) => acc + (p.quotedAmountPaise ?? p.estimatedTotalPaise));

  int get _acceptedCount =>
      _packages.where((p) => p.status == 'accepted').length;

  int get _quotedCount => _packages.where((p) => p.status == 'quoted').length;

  bool get _isBatchFullyAccepted =>
      _packages.isNotEmpty && _packages.every((p) => p.status == 'accepted');

  Future<void> _handleAcceptQuotation(RfqPackageModel package) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.glassBorder),
        ),
        title: const Text(
          'Accept Quotation & Link Escrow',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Accept vendor quotation of ₹${((package.quotedAmountPaise ?? 0) / 100).toStringAsFixed(0)} for "${package.title}"?\n\nThis will lock the milestone in the escrow release schedule.',
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
            height: 1.4,
          ),
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
              foregroundColor: Colors.black,
            ),
            child: const Text('Confirm Acceptance'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isProcessingAction = true);

    try {
      final result = await _apiService.acceptQuotation(package.id);
      if (mounted) {
        setState(() {
          final idx = _packages.indexWhere((p) => p.id == package.id);
          if (idx != -1) {
            _packages[idx] = result.package ??
                package.copyWith(
                  status: 'accepted',
                  paymentMilestoneId: result.paymentMilestoneId,
                );
          }
          _isProcessingAction = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text(
              'Quotation accepted! Escrow milestone: ${result.paymentMilestoneId ?? "Created"}',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessingAction = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(
              'Failed to accept quotation: ${e.toString().replaceFirst("Exception: ", "")}',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        );
      }
    }
  }

  Future<void> _handleDeclineQuotation(RfqPackageModel package) async {
    final reason = await showDialog<String?>(
      context: context,
      builder: (ctx) => DeclineRfqDialog(packageTitle: package.title),
    );

    if (reason == null && !mounted) return;

    setState(() => _isProcessingAction = true);

    try {
      final updatedPkg = await _apiService.declineQuotation(
        package.id,
        declineReason: reason,
      );

      if (mounted) {
        setState(() {
          final idx = _packages.indexWhere((p) => p.id == package.id);
          if (idx != -1) {
            _packages[idx] = updatedPkg;
          }
          _isProcessingAction = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: AppColors.surfaceLighter,
            content: Text(
              'Quotation declined.',
              style: TextStyle(color: Colors.white),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isProcessingAction = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(
              'Failed to decline quotation: ${e.toString().replaceFirst("Exception: ", "")}',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = [
      'ALL',
      'Audio',
      'Lighting',
      'Video',
      'Rigging',
      'Power',
      'Staging',
      'Backline',
      'Other',
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background.withValues(alpha: 0.95),
        elevation: 0,
        title: Column(
          children: [
            const Text(
              'PROCUREMENT PIPELINE',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 12,
                letterSpacing: 2.0,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (widget.eventName != null) ...[
              const SizedBox(height: 2),
              Text(
                widget.eventName!,
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ],
          ],
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.primary),
            tooltip: 'Refresh Packages',
            onPressed: _isLoading ? null : _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _errorMessage != null
              ? _buildErrorView()
              : RefreshIndicator(
                  color: AppColors.primary,
                  backgroundColor: AppColors.surface,
                  onRefresh: _loadData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Metric Summary Cards
                        _buildSummaryMetricsHeader(),
                        const SizedBox(height: 20),

                        // Escrow Milestone Timeline Toggle & Widget
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'ESCROW MILESTONES',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.2,
                              ),
                            ),
                            TextButton.icon(
                              onPressed: () {
                                setState(() {
                                  _showTimeline = !_showTimeline;
                                });
                              },
                              icon: Icon(
                                _showTimeline
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 14,
                                color: AppColors.primary,
                              ),
                              label: Text(
                                _showTimeline ? 'Hide Timeline' : 'Show Timeline',
                                style: const TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        if (_showTimeline) ...[
                          const SizedBox(height: 8),
                          PaymentMilestoneTimelineWidget(
                            packages: _packages,
                            isBatchFullyAccepted: _isBatchFullyAccepted,
                            totalEstimatedCostPaise: _totalEstimatedCostPaise,
                            totalApprovedCostPaise: _totalApprovedCostPaise,
                          ),
                          const SizedBox(height: 24),
                        ] else
                          const SizedBox(height: 12),

                        // Section Title: RFQ Packages
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'RFQ PACKAGES (${_packages.length})',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                              ),
                            ),
                            if (_quotedCount > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: AppColors.primary.withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Text(
                                  '$_quotedCount Quoted Needs Review',
                                  style: const TextStyle(
                                    color: AppColors.primary,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Category Filter Chips
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: categories.map((cat) {
                              final isSelected = _selectedCategory == cat;
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: FilterChip(
                                  label: Text(cat),
                                  selected: isSelected,
                                  onSelected: (selected) {
                                    setState(() {
                                      _selectedCategory = cat;
                                    });
                                  },
                                  selectedColor: AppColors.primary,
                                  backgroundColor: AppColors.surface,
                                  labelStyle: TextStyle(
                                    color: isSelected ? Colors.black : Colors.white70,
                                    fontWeight: isSelected
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                    fontSize: 12,
                                  ),
                                  side: BorderSide(
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.glassBorder,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  showCheckmark: false,
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Status Filter Chips
                        Row(
                          children: [
                            _buildStatusFilterChip('ALL', 'All'),
                            const SizedBox(width: 8),
                            _buildStatusFilterChip('quoted', 'Quoted ($_quotedCount)'),
                            const SizedBox(width: 8),
                            _buildStatusFilterChip('accepted', 'Accepted ($_acceptedCount)'),
                            const SizedBox(width: 8),
                            _buildStatusFilterChip('pending', 'Pending'),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Package Cards List or Empty View
                        if (_filteredPackages.isEmpty)
                          _buildEmptyPackagesView()
                        else
                          ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _filteredPackages.length,
                            itemBuilder: (context, index) {
                              final pkg = _filteredPackages[index];
                              return RfqPackageCard(
                                package: pkg,
                                isProcessing: _isProcessingAction,
                                onAccept: _handleAcceptQuotation,
                                onDecline: _handleDeclineQuotation,
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildSummaryMetricsHeader() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.15),
            AppColors.surface,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'TOTAL ESTIMATE',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${(_totalEstimatedCostPaise / 100).toStringAsFixed(0)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'APPROVED ESCROW',
                    style: TextStyle(
                      color: Color(0xFF10B981),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${(_totalApprovedCostPaise / 100).toStringAsFixed(0)}',
                    style: const TextStyle(
                      color: Color(0xFF10B981),
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: _packages.isEmpty ? 0 : _acceptedCount / _packages.length,
              backgroundColor: AppColors.surfaceLighter,
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF10B981)),
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$_acceptedCount of ${_packages.length} packages accepted',
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 11,
                ),
              ),
              Text(
                _isBatchFullyAccepted ? '100% Ready' : '${_packages.length - _acceptedCount} remaining',
                style: TextStyle(
                  color: _isBatchFullyAccepted
                      ? const Color(0xFF10B981)
                      : AppColors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusFilterChip(String key, String label) {
    final isSelected = _selectedStatus == key;
    return InkWell(
      onTap: () {
        setState(() {
          _selectedStatus = key;
        });
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.2)
              : AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.glassBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? AppColors.primary : AppColors.textSecondary,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyPackagesView() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.inventory_2_outlined,
            size: 48,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: 14),
          const Text(
            'No RFQ Packages Found',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _selectedCategory != 'ALL' || _selectedStatus != 'ALL'
                ? 'Try clearing active category or status filters.'
                : 'No procurement packages have been dispatched for this workflow yet.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          if (_selectedCategory != 'ALL' || _selectedStatus != 'ALL') ...[
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _selectedCategory = 'ALL';
                  _selectedStatus = 'ALL';
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
              ),
              child: const Text('Clear Filters'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
            const SizedBox(height: 16),
            const Text(
              'Failed to Load Procurement Pipeline',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? 'An unexpected error occurred.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
