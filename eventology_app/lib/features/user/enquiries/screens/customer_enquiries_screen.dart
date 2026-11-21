import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/enquiries_model.dart';
import '../../../../services/auth_state_notifier.dart';
import '../../../../services/firestore/enquiries_repository.dart';
import '../../../../services/quotation_api_service.dart';
import '../widgets/customer_quotation_dialog.dart';

/// Customer-facing screen for viewing and tracking the status of submitted
/// venue availability and vendor service enquiries.
class CustomerEnquiriesScreen extends StatefulWidget {
  /// Optional stream override for testing or custom scoping.
  final Stream<List<EnquiryModel>>? enquiryStream;

  /// Optional customer ID override for testing environments.
  final String? testCustomerId;

  /// Optional QuotationApiService override for test doubles or custom base URLs.
  final QuotationApiService? quotationApiService;

  const CustomerEnquiriesScreen({
    super.key,
    this.enquiryStream,
    this.testCustomerId,
    this.quotationApiService,
  });

  @override
  State<CustomerEnquiriesScreen> createState() => _CustomerEnquiriesScreenState();
}

class _CustomerEnquiriesScreenState extends State<CustomerEnquiriesScreen> {
  String _selectedFilter = 'all'; // 'all', 'pending', 'vendor_accepted', 'declined'
  late final QuotationApiService _quotationApi;

  @override
  void initState() {
    super.initState();
    _quotationApi = widget.quotationApiService ?? QuotationApiService();
  }

  @override
  Widget build(BuildContext context) {
    // Strictly obtain the customer ID from the authenticated session unless test-injected
    final customerId = widget.testCustomerId ?? authStateNotifier.userId;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background.withValues(alpha: 0.95),
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: const Text(
          'MY ENQUIRIES',
          style: TextStyle(
            color: AppColors.primary,
            fontSize: 13,
            letterSpacing: 2.0,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: customerId == null || customerId.trim().isEmpty
          ? _buildUnauthenticatedState(context)
          : Column(
              children: [
                _buildFilterChips(),
                Expanded(
                  child: StreamBuilder<List<EnquiryModel>>(
                    stream: widget.enquiryStream ??
                        EnquiriesRepository.streamCustomerEnquiries(customerId),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(color: AppColors.primary),
                              SizedBox(height: 16),
                              Text(
                                'Loading your enquiries...',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 13,
                                ),
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
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.error_outline_rounded,
                                  color: AppColors.error,
                                  size: 48,
                                ),
                                const SizedBox(height: 16),
                                const Text(
                                  'Unable to load enquiries',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  snapshot.error.toString(),
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }

                      final allEnquiries = snapshot.data ?? [];

                      if (allEnquiries.isEmpty) {
                        return _buildEmptyState(
                          context,
                          title: 'No Enquiries Yet',
                          subtitle:
                              'You have not submitted any venue availability or vendor enquiries yet. Explore our curated collections to get started.',
                          buttonLabel: 'Explore Catalog',
                          onPressed: () => context.push('/venues'),
                        );
                      }

                      // Apply client-side filter
                      final filtered = _selectedFilter == 'all'
                          ? allEnquiries
                          : allEnquiries
                              .where((e) => e.status == _selectedFilter)
                              .toList();

                      if (filtered.isEmpty) {
                        return _buildEmptyState(
                          context,
                          title: 'No ${_filterTitle(_selectedFilter)} Enquiries',
                          subtitle:
                              'You have no enquiries matching this status filter.',
                          buttonLabel: 'Show All Enquiries',
                          onPressed: () =>
                              setState(() => _selectedFilter = 'all'),
                        );
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          return _buildEnquiryCard(context, filtered[index]);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {'key': 'all', 'label': 'All'},
      {'key': 'pending', 'label': 'Pending'},
      {'key': 'vendor_accepted', 'label': 'Accepted'},
      {'key': 'declined', 'label': 'Declined'},
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: SingleChildScrollView(
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
                    fontSize: 12,
                    fontWeight:
                        isSelected ? FontWeight.bold : FontWeight.normal,
                    color: isSelected ? Colors.black : AppColors.textSecondary,
                  ),
                ),
                selected: isSelected,
                selectedColor: AppColors.primary,
                backgroundColor: AppColors.surfaceLighter,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(
                    color: isSelected
                        ? AppColors.primary
                        : AppColors.glassBorder,
                  ),
                ),
                showCheckmark: false,
                onSelected: (selected) {
                  if (selected) {
                    setState(() => _selectedFilter = f['key']!);
                  }
                },
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildEnquiryCard(BuildContext context, EnquiryModel enquiry) {
    final reqs = enquiry.requirements ?? {};
    final isVenue = reqs['type'] == 'venue' || enquiry.vendorId.isEmpty;
    final title = (isVenue ? reqs['venueName'] : reqs['vendorName']) as String? ??
        (enquiry.vendorId.isNotEmpty
            ? 'Vendor Enquiry (${enquiry.vendorId})'
            : 'General Enquiry');

    final guestCount = reqs['guestCount'];
    final requestedDateFormatted =
        DateFormat('EEE, dd MMM yyyy').format(enquiry.requestedDate.toDate());
    final createdAtFormatted =
        DateFormat('dd MMM yyyy, hh:mm a').format(enquiry.createdAt.toDate());

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Category icon + Title + Status chip
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isVenue ? Icons.business_rounded : Icons.storefront_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isVenue ? 'Venue Availability' : 'Vendor Services',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              _buildStatusBadge(enquiry.status),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: AppColors.glassBorder, height: 1),
          const SizedBox(height: 12),

          // Event Parameters: Target date + Guest count
          Row(
            children: [
              const Icon(
                Icons.calendar_today_rounded,
                size: 14,
                color: AppColors.primary,
              ),
              const SizedBox(width: 6),
              Text(
                requestedDateFormatted,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (guestCount != null) ...[
                const SizedBox(width: 16),
                const Icon(
                  Icons.people_outline_rounded,
                  size: 15,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text(
                  '$guestCount Guests',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),

          // Customer Message
          if (enquiry.message.isNotEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLighter,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Text(
                enquiry.message,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
            ),

          if (enquiry.status == 'vendor_accepted') ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                key: Key('review_quote_${enquiry.enquiryId}'),
                onPressed: () => _openQuotationDialog(context, enquiry),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.receipt_long_rounded, size: 18),
                label: const Text(
                  'Review Quotation & Book',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ),
          ] else if (enquiry.status == 'accepted') ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: Key('view_quote_${enquiry.enquiryId}'),
                onPressed: () => _openQuotationDialog(context, enquiry),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF10B981)),
                  foregroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                label: const Text(
                  'View Accepted Quotation',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ),
          ],

          const SizedBox(height: 12),

          // Status Guidance Note
          _buildStatusGuidance(enquiry.status),

          const SizedBox(height: 8),

          // Submission footer
          Text(
            'Submitted on $createdAtFormatted',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }

  void _openQuotationDialog(BuildContext context, EnquiryModel enquiry) {
    showDialog(
      context: context,
      builder: (context) => CustomerQuotationDialog(
        enquiry: enquiry,
        apiService: _quotationApi,
        onStatusChanged: () => setState(() {}),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color textColor;
    Color bgColor;
    String label;

    switch (status.toLowerCase()) {
      case 'vendor_accepted':
      case 'accepted':
        textColor = const Color(0xFF10B981);
        bgColor = const Color(0xFF10B981).withValues(alpha: 0.15);
        label = 'ACCEPTED';
        break;
      case 'declined':
        textColor = AppColors.error;
        bgColor = AppColors.error.withValues(alpha: 0.15);
        label = 'DECLINED';
        break;
      case 'pending':
      default:
        textColor = const Color(0xFFF59E0B);
        bgColor = const Color(0xFFF59E0B).withValues(alpha: 0.15);
        label = 'PENDING';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: textColor.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildStatusGuidance(String status) {
    String note;
    IconData icon;
    Color iconColor;

    switch (status.toLowerCase()) {
      case 'vendor_accepted':
        note =
            'Partner accepted your enquiry and sent a quotation! Review line items and pricing above to confirm booking.';
        icon = Icons.receipt_long_rounded;
        iconColor = const Color(0xFF06B6D4);
        break;
      case 'accepted':
        note =
            'Quotation accepted! Confirmed booking has been created and partner allocated.';
        icon = Icons.check_circle_outline_rounded;
        iconColor = const Color(0xFF10B981);
        break;
      case 'declined':
        note =
            'Partner is unavailable for this date. Check alternate verified venues or vendors in catalog.';
        icon = Icons.info_outline_rounded;
        iconColor = AppColors.error;
        break;
      case 'pending':
      default:
        note =
            'Enquiry is under partner review. You will receive an update once availability is confirmed.';
        icon = Icons.hourglass_top_rounded;
        iconColor = const Color(0xFFF59E0B);
        break;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            note,
            style: TextStyle(
              color: iconColor.withValues(alpha: 0.85),
              fontSize: 11,
              height: 1.3,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(
    BuildContext context, {
    required String title,
    required String subtitle,
    required String buttonLabel,
    required VoidCallback onPressed,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: const Icon(
                Icons.assignment_outlined,
                color: AppColors.primary,
                size: 44,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                buttonLabel,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUnauthenticatedState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: const Icon(
                Icons.lock_outline_rounded,
                color: AppColors.primary,
                size: 44,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Sign In Required',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Please sign in to view your submitted enquiries and track partner availability.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/login'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Sign In',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _filterTitle(String key) {
    switch (key) {
      case 'pending':
        return 'Pending';
      case 'vendor_accepted':
        return 'Accepted';
      case 'declined':
        return 'Declined';
      default:
        return 'Filtered';
    }
  }
}
