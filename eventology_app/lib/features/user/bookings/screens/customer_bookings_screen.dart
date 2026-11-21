import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/bookings_model.dart';
import '../../../../services/auth_state_notifier.dart';
import '../../../../services/cancellation_api_service.dart';
import '../../../../services/firestore/bookings_repository.dart';
import '../../../../services/payment_api_service.dart';
import '../widgets/cancellation_dialogs.dart';
import 'booking_checkout_screen.dart';

/// Screen listing all vendor bookings belonging to the authenticated customer.
class CustomerBookingsScreen extends StatefulWidget {
  final Stream<List<BookingModel>>? bookingStream;
  final String? testCustomerId;
  final PaymentApiService? paymentApiService;
  final CancellationApiService? cancellationApiService;

  const CustomerBookingsScreen({
    super.key,
    this.bookingStream,
    this.testCustomerId,
    this.paymentApiService,
    this.cancellationApiService,
  });

  @override
  State<CustomerBookingsScreen> createState() => _CustomerBookingsScreenState();
}

class _CustomerBookingsScreenState extends State<CustomerBookingsScreen> {
  String _selectedFilter = 'all'; // 'all', 'unpaid', 'paid'

  @override
  Widget build(BuildContext context) {
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
              context.go('/profile');
            }
          },
        ),
        title: const Text(
          'MY BOOKINGS',
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
                  child: StreamBuilder<List<BookingModel>>(
                    stream: widget.bookingStream ??
                        BookingsRepository.streamCustomerBookings(customerId),
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(
                          child: CircularProgressIndicator(color: AppColors.primary),
                        );
                      }

                      if (snapshot.hasError) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24.0),
                            child: Text(
                              'Error loading bookings: ${snapshot.error}',
                              style: const TextStyle(color: AppColors.error),
                            ),
                          ),
                        );
                      }

                      final allBookings = snapshot.data ?? [];
                      if (allBookings.isEmpty) {
                        return _buildEmptyState(
                          context,
                          title: 'No Bookings Yet',
                          subtitle:
                              'When you accept vendor quotations or finalize events, your confirmed bookings will appear here.',
                          buttonLabel: 'Explore Enquiries',
                          onPressed: () => context.push('/my-enquiries'),
                        );
                      }

                      final filtered = _selectedFilter == 'all'
                          ? allBookings
                          : _selectedFilter == 'paid'
                              ? allBookings.where((b) => b.isPaid).toList()
                              : allBookings.where((b) => b.isUnpaid).toList();

                      if (filtered.isEmpty) {
                        return _buildEmptyState(
                          context,
                          title: 'No ${_selectedFilter.toUpperCase()} Bookings',
                          subtitle: 'You have no bookings matching this status filter.',
                          buttonLabel: 'Show All',
                          onPressed: () => setState(() => _selectedFilter = 'all'),
                        );
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          return _buildBookingCard(context, filtered[index]);
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
      {'key': 'unpaid', 'label': 'Payment Due'},
      {'key': 'paid', 'label': 'Paid'},
    ];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
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
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.black : AppColors.textSecondary,
                ),
              ),
              selected: isSelected,
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surfaceLighter,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: isSelected ? AppColors.primary : AppColors.glassBorder),
              ),
              showCheckmark: false,
              onSelected: (selected) {
                if (selected) setState(() => _selectedFilter = f['key']!);
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildBookingCard(BuildContext context, BookingModel booking) {
    final dateFormatted = DateFormat('EEE, dd MMM yyyy').format(booking.bookingDate.toDate());
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    final formattedAmount = '₹${formatter.format(booking.amount)}';

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
              Text(
                'Booking #${booking.bookingId.length > 8 ? booking.bookingId.substring(0, 8).toUpperCase() : booking.bookingId.toUpperCase()}',
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
              Wrap(
                spacing: 6,
                children: [
                  _buildBadge(booking.paymentStatus),
                  if (booking.cancellationStatus != null)
                    _buildCancellationBadge(booking.cancellationStatus!),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(color: AppColors.glassBorder, height: 1),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(dateFormatted, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              const Spacer(),
              Text(
                formattedAmount,
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (!booking.isCancelled) ...[
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                key: Key('checkout_btn_${booking.bookingId}'),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (ctx) => BookingCheckoutScreen(
                        bookingId: booking.bookingId,
                        initialBooking: booking,
                        paymentApiService: widget.paymentApiService,
                      ),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: booking.isPaid ? AppColors.surfaceLighter : AppColors.primary,
                  foregroundColor: booking.isPaid ? Colors.white : Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: Icon(
                  booking.isPaid ? Icons.receipt_long_rounded : Icons.lock_outline_rounded,
                  size: 16,
                ),
                label: Text(
                  booking.isPaid ? 'View Invoice & Receipt' : 'Checkout & Pay ($formattedAmount)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
          if (booking.cancellationStatus != null) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: Key('view_cancellation_btn_${booking.bookingId}'),
                onPressed: () => _openCancellationStatusModal(context, booking),
                icon: const Icon(Icons.info_outline, size: 16, color: AppColors.primary),
                label: const Text('View Cancellation Status', style: TextStyle(color: AppColors.primary, fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ] else if (!booking.isCancelled) ...[
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                key: Key('cancel_booking_btn_${booking.bookingId}'),
                onPressed: () => _openCancellationDialog(context, booking),
                icon: const Icon(Icons.cancel_outlined, size: 15, color: AppColors.error),
                label: const Text('Request Cancellation', style: TextStyle(color: AppColors.error, fontSize: 12)),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _openCancellationDialog(BuildContext context, BookingModel booking) {
    showDialog(
      context: context,
      builder: (ctx) => CustomerCancellationRequestDialog(
        booking: booking,
        apiService: widget.cancellationApiService,
        onSuccess: () => setState(() {}),
      ),
    );
  }

  Future<void> _openCancellationStatusModal(
      BuildContext context, BookingModel booking) async {
    final api = widget.cancellationApiService ?? cancellationApiService;
    try {
      final req = await api.fetchCancellationByBooking(booking.bookingId);
      if (req != null && context.mounted) {
        showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (ctx) => CustomerCancellationStatusModal(
            request: req,
            apiService: widget.cancellationApiService,
            onWithdrawn: () => setState(() {}),
          ),
        );
      } else if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No active cancellation request record found.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load cancellation details: $e')),
        );
      }
    }
  }

  Widget _buildCancellationBadge(String status) {
    Color color;
    String label;
    switch (status) {
      case 'cancellation_requested':
      case 'under_review':
        color = const Color(0xFFF59E0B);
        label = 'CANCELLATION REQUESTED';
        break;
      case 'cancellation_approved':
        color = const Color(0xFF10B981);
        label = 'CANCELLED';
        break;
      case 'cancellation_rejected':
        color = const Color(0xFFEF4444);
        label = 'REQUEST REJECTED';
        break;
      case 'cancellation_completed':
        color = const Color(0xFF10B981);
        label = 'COMPLETED';
        break;
      case 'request_withdrawn':
        color = AppColors.textSecondary;
        label = 'WITHDRAWN';
        break;
      default:
        color = AppColors.textSecondary;
        label = status.toUpperCase();
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

  Widget _buildBadge(String status) {
    final isPaid = status.toLowerCase() == 'paid';
    final color = isPaid ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    final label = isPaid ? 'PAID' : 'PAYMENT DUE';

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
              child: const Icon(Icons.bookmark_outline_rounded, color: AppColors.primary, size: 40),
            ),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
              ),
              child: Text(buttonLabel),
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
            const Icon(Icons.lock_outline_rounded, color: AppColors.primary, size: 44),
            const SizedBox(height: 16),
            const Text('Sign In Required', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text('Please sign in to view your bookings and manage payment checkout.',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.go('/login'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
              child: const Text('Sign In'),
            ),
          ],
        ),
      ),
    );
  }
}
