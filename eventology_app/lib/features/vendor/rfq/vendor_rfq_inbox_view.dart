import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/rfq_model.dart';
import '../../../services/rfq_api_service.dart';
import '../vendor_session.dart';
import 'widgets/vendor_quotation_submission_dialog.dart';
import 'widgets/vendor_rfq_card.dart';

class VendorRfqInboxView extends StatefulWidget {
  final String? vendorId;
  final String? vendorName;
  final RfqApiService? apiService;

  const VendorRfqInboxView({
    super.key,
    this.vendorId,
    this.vendorName,
    this.apiService,
  });

  @override
  State<VendorRfqInboxView> createState() => _VendorRfqInboxViewState();
}

class _VendorRfqInboxViewState extends State<VendorRfqInboxView> {
  late final RfqApiService _apiService;
  List<RfqPackageModel> _packages = [];
  bool _isLoading = true;
  String? _errorMessage;
  String? _processingPackageId;

  String _selectedCategory = 'All';
  String _selectedStatus = 'All';

  final List<String> _categories = [
    'All',
    'Audio',
    'Lighting',
    'Video',
    'Rigging',
    'Power',
    'Staging',
    'Backline',
    'Other',
  ];

  final List<String> _statusFilters = [
    'All',
    'Open',
    'Acknowledged',
    'Quoted',
    'Awarded',
    'Declined',
  ];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? RfqApiService();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadPackages();
    });
  }

  String _resolveVendorId() {
    if (widget.vendorId != null && widget.vendorId!.isNotEmpty) {
      return widget.vendorId!;
    }
    try {
      final vendor = VendorSession.of(context);
      return vendor.vendorId;
    } catch (_) {
      return 'vnd_demo_vendor';
    }
  }

  String _resolveVendorName() {
    if (widget.vendorName != null && widget.vendorName!.isNotEmpty) {
      return widget.vendorName!;
    }
    try {
      final vendor = VendorSession.of(context);
      return vendor.businessName;
    } catch (_) {
      return 'Pro Audio Visuals';
    }
  }

  Future<void> _loadPackages() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final vendorId = _resolveVendorId();
      final packages = await _apiService.getPackagesForVendor(vendorId);
      if (mounted) {
        setState(() {
          _packages = packages;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _handleAcknowledge(RfqPackageModel package) async {
    final vendorId = _resolveVendorId();
    setState(() => _processingPackageId = package.id);

    try {
      final updated = await _apiService.acknowledgeRfq(package.id, vendorId);
      if (mounted) {
        setState(() {
          final idx = _packages.indexWhere((p) => p.id == package.id);
          if (idx != -1) {
            _packages[idx] = updated;
          }
          _processingPackageId = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('Acknowledged receipt of ${package.title}'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _processingPackageId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.error,
            content: Text(
              'Acknowledgement failed: ${e.toString().replaceFirst('Exception: ', '')}',
            ),
          ),
        );
      }
    }
  }

  Future<void> _handleQuote(RfqPackageModel package) async {
    final vendorId = _resolveVendorId();

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => VendorQuotationSubmissionDialog(
        package: package,
        vendorId: vendorId,
        onSubmit: ({
          required int quotedAmountPaise,
          int? counterBidAmountPaise,
          List<RfqItemPriceModel>? itemPrices,
          String? notes,
          int? quoteValidityDays,
          String? deliveryCommitment,
        }) async {
          final updated = await _apiService.submitQuotation(
            package.id,
            vendorId: vendorId,
            quotedAmountPaise: quotedAmountPaise,
            counterBidAmountPaise: counterBidAmountPaise,
            itemPrices: itemPrices,
            notes: notes,
            quoteValidityDays: quoteValidityDays,
            deliveryCommitment: deliveryCommitment,
          );

          if (mounted) {
            setState(() {
              final idx = _packages.indexWhere((p) => p.id == package.id);
              if (idx != -1) {
                _packages[idx] = updated;
              }
            });
          }
        },
      ),
    );

    if (result == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('Quotation submitted successfully to event planner!'),
        ),
      );
    }
  }

  List<RfqPackageModel> get _filteredPackages {
    return _packages.where((pkg) {
      // Category filter
      if (_selectedCategory != 'All' && pkg.category != _selectedCategory) {
        return false;
      }
      // Status filter
      if (_selectedStatus == 'Open' && !pkg.isDispatched) {
        return false;
      }
      if (_selectedStatus == 'Acknowledged' && !pkg.isAcknowledged) {
        return false;
      }
      if (_selectedStatus == 'Quoted' && !pkg.isQuoted) {
        return false;
      }
      if (_selectedStatus == 'Awarded' && !pkg.isAccepted) {
        return false;
      }
      if (_selectedStatus == 'Declined' && !pkg.isDeclined) {
        return false;
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'PRODUCTION RFQ INBOX',
              style: TextStyle(
                color: AppColors.primary,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              _resolveVendorName(),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
            onPressed: _loadPackages,
            tooltip: 'Refresh RFQs',
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(color: AppColors.glassBorder, height: 1),
        ),
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
                  onRefresh: _loadPackages,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Summary Metrics Bar
                        _buildSummaryMetrics(),
                        const SizedBox(height: 16),

                        // Category Filter Chips
                        _buildCategoryFilter(),
                        const SizedBox(height: 12),

                        // Status Filter Tabs
                        _buildStatusFilter(),
                        const SizedBox(height: 16),

                        // RFQ Packages List
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'RFQ PACKAGES (${_filteredPackages.length})',
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        if (_filteredPackages.isEmpty)
                          _buildEmptyState()
                        else
                          ..._filteredPackages.map(
                            (pkg) => VendorRfqCard(
                              package: pkg,
                              isProcessing: _processingPackageId == pkg.id,
                              onAcknowledge: _handleAcknowledge,
                              onQuote: _handleQuote,
                            ),
                          ),
                        const SizedBox(height: 80),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildSummaryMetrics() {
    final openCount = _packages.where((p) => p.isDispatched).length;
    final quotedCount = _packages.where((p) => p.isQuoted).length;
    final awardedCount = _packages.where((p) => p.isAccepted).length;

    final totalQuotedInr = _packages.where((p) => p.isQuoted).fold<double>(
          0.0,
          (sum, p) => sum + (p.quotedAmountInr ?? 0.0),
        );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  'OPEN RFQS',
                  openCount.toString(),
                  Icons.inbox_outlined,
                  AppColors.primary,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  'QUOTED',
                  quotedCount.toString(),
                  Icons.send_outlined,
                  const Color(0xFFF59E0B),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  'AWARDED',
                  awardedCount.toString(),
                  Icons.verified_outlined,
                  const Color(0xFF10B981),
                ),
              ),
            ],
          ),
          if (totalQuotedInr > 0) ...[
            const Divider(color: AppColors.glassBorder, height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'ACTIVE PIPELINE VALUE',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                ),
                Text(
                  '₹${totalQuotedInr.toStringAsFixed(0)}',
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetricTile(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.background.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: color,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryFilter() {
    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, idx) {
          final cat = _categories[idx];
          final isSelected = _selectedCategory == cat;

          return FilterChip(
            selected: isSelected,
            label: Text(cat),
            labelStyle: TextStyle(
              color: isSelected ? Colors.black : Colors.white70,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
            backgroundColor: AppColors.surface,
            selectedColor: AppColors.primary,
            side: BorderSide(
              color: isSelected ? AppColors.primary : AppColors.glassBorder,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8),
            onSelected: (_) {
              setState(() => _selectedCategory = cat);
            },
          );
        },
      ),
    );
  }

  Widget _buildStatusFilter() {
    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _statusFilters.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, idx) {
          final status = _statusFilters[idx];
          final isSelected = _selectedStatus == status;

          return ChoiceChip(
            selected: isSelected,
            label: Text(status),
            labelStyle: TextStyle(
              color: isSelected ? Colors.black : Colors.white70,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
            backgroundColor: AppColors.surface,
            selectedColor: Colors.white,
            side: BorderSide(
              color: isSelected ? Colors.white : AppColors.glassBorder,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8),
            onSelected: (_) {
              setState(() => _selectedStatus = status);
            },
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Icon(
            Icons.inbox_outlined,
            size: 48,
            color: AppColors.textSecondary.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 12),
          const Text(
            'No RFQ Packages Found',
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _selectedCategory != 'All' || _selectedStatus != 'All'
                ? 'No packages match the selected filters.'
                : 'No equipment RFQs have been dispatched to your category yet.',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
            textAlign: TextAlign.center,
          ),
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
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: 16),
            const Text(
              'Failed to Load RFQ Inbox',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? 'An error occurred while loading packages.',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _loadPackages,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
