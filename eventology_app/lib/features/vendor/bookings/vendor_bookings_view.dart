import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../vendor_session.dart';
import '../../../services/firestore/bookings_repository.dart';
import '../../../services/fulfillment_api_service.dart';
import '../../../models/bookings_model.dart';
import 'package:intl/intl.dart';

class VendorBookingsView extends StatefulWidget {
  final FulfillmentApiService? fulfillmentApi;
  final Stream<List<BookingModel>>? bookingsStream;

  const VendorBookingsView({
    super.key,
    this.fulfillmentApi,
    this.bookingsStream,
  });

  @override
  State<VendorBookingsView> createState() => _VendorBookingsViewState();
}

class _VendorBookingsViewState extends State<VendorBookingsView> {
  late final FulfillmentApiService _fulfillmentApi;
  String _filter = 'all'; // all, in_delivery, review_pending, completed, unpaid
  bool _isActionInProgress = false;

  @override
  void initState() {
    super.initState();
    _fulfillmentApi = widget.fulfillmentApi ?? FulfillmentApiService();
  }

  @override
  Widget build(BuildContext context) {
    String vendorId = '';
    try {
      final vendor = VendorSession.of(context);
      vendorId = vendor.id;
    } catch (_) {
      // In tests, vendor session might be absent if bookingsStream is supplied
    }

    final stream = widget.bookingsStream ?? BookingsRepository.streamVendorBookings(vendorId);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background.withValues(alpha: 0.95),
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Service Delivery & Fulfillment',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
      body: Column(
        children: [
          _buildFilterTabs(),
          Expanded(
            child: StreamBuilder<List<BookingModel>>(
              stream: stream,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Text(
                      'Error loading bookings: ${snapshot.error}',
                      style: const TextStyle(color: Colors.red),
                    ),
                  );
                }

                final allBookings = snapshot.data ?? [];
                final filtered = _filterBookings(allBookings);

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.inventory_2_outlined, size: 64, color: Colors.white24),
                        const SizedBox(height: 16),
                        Text(
                          'No bookings found under ${_filter.replaceAll('_', ' ')}.',
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 120),
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

  List<BookingModel> _filterBookings(List<BookingModel> bookings) {
    switch (_filter) {
      case 'in_delivery':
        return bookings.where((b) {
          if (!b.isPaid) return false;
          return [
            'confirmed',
            'prep_started',
            'setup_in_progress',
            'setup_completed',
            'delivered',
            'rejected',
          ].contains(b.fulfillmentStatus);
        }).toList();
      case 'review_pending':
        return bookings.where((b) => b.fulfillmentStatus == 'review_pending').toList();
      case 'completed':
        return bookings.where((b) => b.fulfillmentStatus == 'completed').toList();
      case 'unpaid':
        return bookings.where((b) => b.isUnpaid).toList();
      case 'all':
      default:
        return bookings;
    }
  }

  Widget _buildFilterTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _buildTab('All', 'all'),
          const SizedBox(width: 8),
          _buildTab('In Delivery', 'in_delivery'),
          const SizedBox(width: 8),
          _buildTab('Review Pending', 'review_pending'),
          const SizedBox(width: 8),
          _buildTab('Completed', 'completed'),
          const SizedBox(width: 8),
          _buildTab('Unpaid', 'unpaid'),
        ],
      ),
    );
  }

  Widget _buildTab(String label, String status) {
    final isSelected = _filter == status;
    return GestureDetector(
      key: Key('filter_tab_$status'),
      onTap: () => setState(() => _filter = status),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.white10,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? AppColors.primary : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildBookingCard(BuildContext context, BookingModel booking) {
    final formattedDate = DateFormat('MMM dd, yyyy').format(booking.targetDate.toDate());

    return Container(
      key: Key('booking_card_${booking.id}'),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: booking.isCompleted
              ? const Color(0xFF10B981).withValues(alpha: 0.5)
              : booking.isRejected
                  ? Colors.redAccent.withValues(alpha: 0.5)
                  : Colors.white10,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Booking ID and Fulfillment Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Booking #${booking.id.length > 8 ? booking.id.substring(0, 8) : booking.id}',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13),
              ),
              _buildFulfillmentBadge(booking.fulfillmentStatus),
            ],
          ),
          const SizedBox(height: 12),

          // Date, Amount & Payment Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.calendar_month, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    formattedDate,
                    style: const TextStyle(fontSize: 12, color: Colors.white),
                  ),
                ],
              ),
              Row(
                children: [
                  Text(
                    '₹${booking.totalAmount.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: booking.isPaid
                          ? const Color(0xFF10B981).withValues(alpha: 0.15)
                          : Colors.orangeAccent.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      booking.isPaid ? 'PAID' : 'UNPAID',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: booking.isPaid ? const Color(0xFF10B981) : Colors.orangeAccent,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Status Notices & Action Controls
          if (booking.isUnpaid) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.orange.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.orange.withValues(alpha: 0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.hourglass_top_rounded, color: Colors.orangeAccent, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Awaiting customer payment before commencing fulfillment.',
                      style: TextStyle(color: Colors.orangeAccent, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (booking.isRejected) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.redAccent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.redAccent.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 16),
                      SizedBox(width: 8),
                      Text(
                        'Completion Rejected by Admin',
                        style: TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  if (booking.completionReview?['reason'] != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Reason: ${booking.completionReview!['reason']}',
                      style: const TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                key: Key('resubmit_evidence_button_${booking.id}'),
                onPressed: _isActionInProgress ? null : () => _showCompletionDialog(context, booking),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Resubmit Completion Evidence', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ] else if (booking.isReviewPending) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.blueAccent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blueAccent.withValues(alpha: 0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.rule_folder_rounded, color: Colors.blueAccent, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Completion evidence submitted. Awaiting administrative verification.',
                      style: TextStyle(color: Colors.blueAccent, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (booking.isCompleted) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.25)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Service delivery approved. Eligible for administrative settlement review.',
                      style: TextStyle(color: Color(0xFF10B981), fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            // Active fulfillment progression buttons
            _buildMilestoneActionButton(context, booking),
          ],
        ],
      ),
    );
  }

  Widget _buildFulfillmentBadge(String status) {
    Color color;
    switch (status) {
      case 'completed':
        color = const Color(0xFF10B981);
        break;
      case 'review_pending':
        color = Colors.blueAccent;
        break;
      case 'rejected':
        color = Colors.redAccent;
        break;
      case 'delivered':
        color = Colors.purpleAccent;
        break;
      case 'setup_completed':
      case 'setup_in_progress':
      case 'prep_started':
        color = AppColors.primary;
        break;
      default:
        color = AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildMilestoneActionButton(BuildContext context, BookingModel booking) {
    String buttonText;
    String? nextMilestone;
    bool isCompletionAction = false;

    switch (booking.fulfillmentStatus) {
      case 'confirmed':
        buttonText = 'Start Preparation';
        nextMilestone = 'prep_started';
        break;
      case 'prep_started':
        buttonText = 'Start Setup / Delivery';
        nextMilestone = 'setup_in_progress';
        break;
      case 'setup_in_progress':
        buttonText = 'Mark Setup Complete';
        nextMilestone = 'setup_completed';
        break;
      case 'setup_completed':
        buttonText = 'Mark Service Delivered';
        nextMilestone = 'delivered';
        break;
      case 'delivered':
        buttonText = 'Submit Completion Evidence';
        isCompletionAction = true;
        break;
      default:
        buttonText = 'Start Preparation';
        nextMilestone = 'prep_started';
    }

    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        key: Key('milestone_button_${booking.id}'),
        onPressed: _isActionInProgress
            ? null
            : () {
                if (isCompletionAction) {
                  _showCompletionDialog(context, booking);
                } else if (nextMilestone != null) {
                  _advanceMilestone(booking.id, nextMilestone);
                }
              },
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Text(buttonText, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Future<void> _advanceMilestone(String bookingId, String milestone) async {
    setState(() => _isActionInProgress = true);
    try {
      await _fulfillmentApi.updateMilestone(bookingId: bookingId, milestone: milestone);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Milestone updated to ${milestone.replaceAll('_', ' ')}.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isActionInProgress = false);
    }
  }

  void _showCompletionDialog(BuildContext context, BookingModel booking) {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final notesController = TextEditingController();
    final urlController = TextEditingController();
    final checklist = [
      'Scope delivered per agreed quotation',
      'On-site client walkthrough conducted',
      'Venue cleared / handover completed',
    ];
    final selectedChecks = <String>{};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (modalCtx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Submit Completion Evidence',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white54),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Delivery Notes (Required)',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const Key('completion_notes_input'),
                  controller: notesController,
                  maxLines: 3,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Describe service completion, deliverables handed over, etc.',
                    hintStyle: const TextStyle(color: Colors.white24, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Completion Checklist',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 6),
                ...checklist.map(
                  (item) => CheckboxListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.primary,
                    checkColor: Colors.black,
                    title: Text(item, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    value: selectedChecks.contains(item),
                    onChanged: (val) {
                      setModalState(() {
                        if (val == true) {
                          selectedChecks.add(item);
                        } else {
                          selectedChecks.remove(item);
                        }
                      });
                    },
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Evidence Reference URL (Optional)',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const Key('completion_evidence_url_input'),
                  controller: urlController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'https://...',
                    hintStyle: const TextStyle(color: Colors.white24, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.background,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    key: const Key('submit_evidence_action_button'),
                    onPressed: () async {
                      final notes = notesController.text.trim();
                      if (notes.isEmpty) {
                        scaffoldMessenger.hideCurrentSnackBar();
                        scaffoldMessenger.showSnackBar(
                          const SnackBar(content: Text('Please enter delivery notes before submitting.')),
                        );
                        return;
                      }

                      final urls = urlController.text.trim().isNotEmpty ? [urlController.text.trim()] : <String>[];

                      setState(() => _isActionInProgress = true);

                      try {
                        await _fulfillmentApi.submitCompletion(
                          bookingId: booking.id,
                          notes: notes,
                          checklistCompleted: selectedChecks.toList(),
                          evidenceUrls: urls,
                        );
                        if (ctx.mounted) {
                          Navigator.pop(ctx);
                        }
                        if (mounted) {
                          scaffoldMessenger.hideCurrentSnackBar();
                          scaffoldMessenger.showSnackBar(
                            const SnackBar(content: Text('Completion evidence submitted for administrative review.')),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          scaffoldMessenger.hideCurrentSnackBar();
                          scaffoldMessenger.showSnackBar(
                            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                          );
                        }
                      } finally {
                        if (mounted) setState(() => _isActionInProgress = false);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Submit for Admin Review', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
