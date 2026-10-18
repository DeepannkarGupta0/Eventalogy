import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/enquiries_model.dart';
import '../../../../models/vendor_model.dart';
import '../../../../models/venue_model.dart';
import '../../../../services/auth_state_notifier.dart';
import '../../../../services/firestore/enquiries_repository.dart';

typedef EnquirySubmitCallback = Future<String> Function(EnquiryModel enquiry);

/// Bottom sheet dialog for submitting manual vendor or venue enquiries.
///
/// Collects target date, message, and optional guest count, validates input,
/// guards against duplicate submissions, and persists via [EnquiriesRepository].
class ManualEnquirySheet extends StatefulWidget {
  final VendorModel? vendor;
  final VenueModel? venue;
  final EnquirySubmitCallback? onSubmit;
  final User? currentUser;

  const ManualEnquirySheet({
    super.key,
    this.vendor,
    this.venue,
    this.onSubmit,
    this.currentUser,
  }) : assert(vendor != null || venue != null, 'Either vendor or venue must be provided');

  factory ManualEnquirySheet.forVendor({
    Key? key,
    required VendorModel vendor,
    EnquirySubmitCallback? onSubmit,
    User? currentUser,
  }) {
    return ManualEnquirySheet(
      key: key,
      vendor: vendor,
      onSubmit: onSubmit,
      currentUser: currentUser,
    );
  }

  factory ManualEnquirySheet.forVenue({
    Key? key,
    required VenueModel venue,
    EnquirySubmitCallback? onSubmit,
    User? currentUser,
  }) {
    return ManualEnquirySheet(
      key: key,
      venue: venue,
      onSubmit: onSubmit,
      currentUser: currentUser,
    );
  }

  static Future<bool?> show(
    BuildContext context, {
    VendorModel? vendor,
    VenueModel? venue,
    EnquirySubmitCallback? onSubmit,
    User? currentUser,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ManualEnquirySheet(
        vendor: vendor,
        venue: venue,
        onSubmit: onSubmit,
        currentUser: currentUser,
      ),
    );
  }

  @override
  State<ManualEnquirySheet> createState() => _ManualEnquirySheetState();
}

class _ManualEnquirySheetState extends State<ManualEnquirySheet> {
  final _formKey = GlobalKey<FormState>();
  final _messageController = TextEditingController();
  final _guestsController = TextEditingController();

  DateTime? _selectedDate;
  String? _dateError;
  bool _isSubmitting = false;
  String? _errorMessage;

  bool get _isVenue => widget.venue != null;
  String get _targetName => _isVenue ? widget.venue!.name : widget.vendor!.businessName;

  @override
  void dispose() {
    _messageController.dispose();
    _guestsController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now.add(const Duration(days: 7)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 730)), // up to 2 years
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: AppColors.primary,
              onPrimary: Colors.black,
              surface: AppColors.surface,
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _dateError = null;
      });
    }
  }

  User? _resolveUser() {
    if (widget.currentUser != null) return widget.currentUser;
    try {
      return authStateNotifier.user ?? FirebaseAuth.instance.currentUser;
    } catch (_) {
      return null;
    }
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;

    setState(() {
      _errorMessage = null;
    });

    final isFormValid = _formKey.currentState?.validate() ?? false;
    if (_selectedDate == null) {
      setState(() {
        _dateError = 'Please select a target date';
      });
    }

    if (!isFormValid || _selectedDate == null) {
      return;
    }

    final user = _resolveUser();
    if (user == null) {
      setState(() {
        _errorMessage = 'You must be signed in to submit an enquiry.';
      });
      return;
    }

    int? parsedGuests;
    if (_guestsController.text.trim().isNotEmpty) {
      parsedGuests = int.tryParse(_guestsController.text.trim());
    }

    // Build the requirements map distinguishing venue vs vendor while adhering to schema
    final Map<String, dynamic> requirements = {
      'type': _isVenue ? 'venue' : 'vendor',
      if (_isVenue) 'venueId': widget.venue!.venueId,
      if (_isVenue) 'venueName': widget.venue!.name,
      if (!_isVenue) 'vendorName': widget.vendor!.businessName,
      'source': 'manual_discovery',
    };
    if (parsedGuests != null) {
      requirements['guestCount'] = parsedGuests;
    }

    final enquiry = EnquiryModel(
      enquiryId: '',
      eventId: '', // General enquiry not tied to a pre-created AI plan
      customerId: user.uid,
      vendorId: _isVenue ? '' : widget.vendor!.vendorId,
      serviceId: !_isVenue && (widget.vendor!.serviceIds?.isNotEmpty ?? false)
          ? widget.vendor!.serviceIds!.first
          : '',
      message: _messageController.text.trim(),
      requirements: requirements,
      requestedDate: Timestamp.fromDate(_selectedDate!),
      status: 'pending',
      createdAt: Timestamp.now(),
    );

    setState(() {
      _isSubmitting = true;
    });

    try {
      if (widget.onSubmit != null) {
        await widget.onSubmit!(enquiry);
      } else {
        await EnquiriesRepository.create(enquiry);
      }

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = 'Failed to submit enquiry: ${e.toString()}';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _resolveUser();

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              border: Border(
                top: BorderSide(color: AppColors.glassBorder),
                left: BorderSide(color: AppColors.glassBorder),
                right: BorderSide(color: AppColors.glassBorder),
              ),
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Sheet Handle
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),

                    // Header
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _isVenue ? Icons.apartment : Icons.handshake,
                            color: AppColors.primary,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _isVenue ? 'Enquire Availability' : 'Send Enquiry',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _targetName,
                                style: const TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textSecondary),
                          onPressed: () => Navigator.of(context).pop(false),
                        ),
                      ],
                    ),

                    const SizedBox(height: 8),
                    const Text(
                      'This sends an enquiry directly for review. No payment or booking is charged at this stage.',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),

                    if (user == null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.lock_outline, color: AppColors.error, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'You must be signed in to submit an enquiry.',
                                style: TextStyle(color: AppColors.error, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    if (_errorMessage != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.error.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.error),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.error, fontSize: 13),
                        ),
                      ),
                    ],

                    const SizedBox(height: 20),

                    // Date Picker Input
                    const Text(
                      'Target Event Date *',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: _isSubmitting ? null : _pickDate,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLighter,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _dateError != null ? AppColors.error : AppColors.glassBorder,
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today, color: AppColors.primary, size: 20),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _selectedDate == null
                                    ? 'Select requested date'
                                    : DateFormat('EEE, MMM d, yyyy').format(_selectedDate!),
                                style: TextStyle(
                                  color: _selectedDate == null ? AppColors.textSecondary : Colors.white,
                                  fontSize: 14,
                                  fontWeight: _selectedDate == null ? FontWeight.normal : FontWeight.w600,
                                ),
                              ),
                            ),
                            const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                    ),
                    if (_dateError != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        _dateError!,
                        style: const TextStyle(color: AppColors.error, fontSize: 12),
                      ),
                    ],

                    const SizedBox(height: 16),

                    // Estimated Guests (Optional)
                    const Text(
                      'Estimated Guests (Optional)',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _guestsController,
                      enabled: !_isSubmitting,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: _isVenue && widget.venue!.capacity > 0
                            ? 'Max capacity: ${widget.venue!.capacity} guests'
                            : 'e.g. 150',
                        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                        prefixIcon: const Icon(Icons.people_outline, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.surfaceLighter,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.glassBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.primary),
                        ),
                      ),
                      validator: (val) {
                        if (val != null && val.trim().isNotEmpty) {
                          final parsed = int.tryParse(val.trim());
                          if (parsed == null || parsed <= 0) {
                            return 'Enter a valid guest count (> 0)';
                          }
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 16),

                    // Message / Requirements Field
                    const Text(
                      'Message & Requirements *',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _messageController,
                      enabled: !_isSubmitting,
                      maxLines: 3,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: _isVenue
                            ? 'Specify event type, required hours, or specific questions...'
                            : 'Specify required services, timing, or package preferences...',
                        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
                        filled: true,
                        fillColor: AppColors.surfaceLighter,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.glassBorder),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.primary),
                        ),
                        errorBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.error),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please provide details for your enquiry';
                        }
                        if (val.trim().length < 5) {
                          return 'Message must be at least 5 characters';
                        }
                        return null;
                      },
                    ),

                    const SizedBox(height: 24),

                    // Submit Button with Loading & Duplicate Submission Protection
                    ElevatedButton(
                      key: const Key('submit_enquiry_button'),
                      onPressed: _isSubmitting || user == null ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.3),
                        disabledForegroundColor: Colors.black38,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.black,
                              ),
                            )
                          : Text(
                              _isVenue ? 'Submit Availability Enquiry' : 'Submit Vendor Enquiry',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}


