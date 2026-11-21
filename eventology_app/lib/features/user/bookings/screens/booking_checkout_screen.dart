import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/bookings_model.dart';
import '../../../../models/quotations_model.dart';
import '../../../../services/firestore/bookings_repository.dart';
import '../../../../services/payment_api_service.dart';
import '../../../../services/quotation_api_service.dart';

/// Screen for reviewing booking line items and executing secure Razorpay checkout.
class BookingCheckoutScreen extends StatefulWidget {
  final String bookingId;
  final BookingModel? initialBooking;
  final PaymentApiService? paymentApiService;
  final QuotationApiService? quotationApiService;

  const BookingCheckoutScreen({
    super.key,
    required this.bookingId,
    this.initialBooking,
    this.paymentApiService,
    this.quotationApiService,
  });

  @override
  State<BookingCheckoutScreen> createState() => _BookingCheckoutScreenState();
}

class _BookingCheckoutScreenState extends State<BookingCheckoutScreen> {
  late final PaymentApiService _paymentApi;
  late final QuotationApiService _quotationApi;

  BookingModel? _booking;
  QuotationModel? _quotation;
  Map<String, dynamic>? _paymentRecord;

  bool _isLoading = true;
  String? _errorMessage;

  bool _isProcessingPayment = false;
  String? _checkoutError;
  String? _checkoutSuccessMessage;

  @override
  void initState() {
    super.initState();
    _paymentApi = widget.paymentApiService ?? PaymentApiService();
    _quotationApi = widget.quotationApiService ?? QuotationApiService();
    _booking = widget.initialBooking;
    _loadBookingDetails();
  }

  Future<void> _loadBookingDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      BookingModel? booking = _booking;
      booking ??= await BookingsRepository.get(widget.bookingId);

      if (booking == null) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Booking not found.';
          });
        }
        return;
      }

      QuotationModel? quotation;
      if (booking.quotationId != null && booking.quotationId!.isNotEmpty) {
        try {
          quotation = await _quotationApi.fetchQuotation(booking.quotationId!);
        } catch (_) {
          // Non-fatal if quotation fetch fails
        }
      }

      Map<String, dynamic>? paymentRecord;
      if (booking.isPaid) {
        try {
          paymentRecord = await _paymentApi.fetchBookingPayment(booking.bookingId);
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _booking = booking;
          _quotation = quotation;
          _paymentRecord = paymentRecord;
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

  Future<void> _initiateCheckout() async {
    final booking = _booking;
    if (booking == null || _isProcessingPayment) return;

    if (booking.isPaid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This booking has already been paid.')),
      );
      return;
    }

    setState(() {
      _isProcessingPayment = true;
      _checkoutError = null;
      _checkoutSuccessMessage = null;
    });

    try {
      // 1. Create order on server from trusted booking record
      final orderResult = await _paymentApi.createOrder(bookingId: booking.bookingId);
      final orderId = orderResult['orderId'] as String;
      final amountPaise = (orderResult['amount'] as num).toInt();
      final isTestMode = orderResult['isTestMode'] as bool? ?? true;

      if (!mounted) return;

      setState(() {
        _isProcessingPayment = false;
      });

      // 2. Open Razorpay Checkout modal (or sandbox test double)
      final checkoutOutcome = await showDialog<Map<String, dynamic>>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => _RazorpayCheckoutModal(
          orderId: orderId,
          amountPaise: amountPaise,
          isTestMode: isTestMode,
          apiService: _paymentApi,
        ),
      );

      if (checkoutOutcome == null) {
        // User closed or cancelled checkout
        if (mounted) {
          setState(() {
            _isProcessingPayment = false;
            _checkoutError = 'Checkout was cancelled by user. Your booking remains unpaid.';
          });
        }
        return;
      }

      if (checkoutOutcome['status'] == 'failed') {
        if (mounted) {
          setState(() {
            _isProcessingPayment = false;
            _checkoutError = checkoutOutcome['error'] as String? ?? 'Payment transaction failed.';
          });
        }
        return;
      }

      if (checkoutOutcome['status'] == 'success') {
        if (mounted) {
          setState(() {
            _isProcessingPayment = true;
          });
        }
        // 3. Submit cryptographic callback payload to trusted server verification
        final verifyResult = await _paymentApi.verifyPayment(
          razorpayOrderId: checkoutOutcome['razorpay_order_id'] as String,
          razorpayPaymentId: checkoutOutcome['razorpay_payment_id'] as String,
          razorpaySignature: checkoutOutcome['razorpay_signature'] as String,
        );

        if (verifyResult['success'] == true) {
          // Re-fetch booking from server to confirm persisted state
          BookingModel? updatedBooking;
          try {
            updatedBooking = await BookingsRepository.get(booking.bookingId);
          } catch (_) {}

          Map<String, dynamic>? paymentDoc;
          try {
            paymentDoc = await _paymentApi.fetchBookingPayment(booking.bookingId);
          } catch (_) {}

          if (mounted) {
            setState(() {
              _isProcessingPayment = false;
              if (updatedBooking != null) {
                _booking = updatedBooking;
              } else {
                _booking = booking.copyWith(paymentStatus: 'paid');
              }
              _paymentRecord = paymentDoc;
              _checkoutSuccessMessage = 'Payment verified & confirmed! Booking is fully funded.';
            });
          }
        } else {
          throw Exception(verifyResult['error'] ?? 'Server could not verify payment signature.');
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isProcessingPayment = false;
          _checkoutError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  String _formatAmount(double amount) {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(amount)}';
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;

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
              context.go('/my-events');
            }
          },
        ),
        title: const Text(
          'BOOKING CHECKOUT',
          style: TextStyle(
            color: AppColors.primary,
            fontSize: 13,
            letterSpacing: 2.0,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: AppColors.primary),
                  SizedBox(height: 16),
                  Text('Loading booking details...', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ],
              ),
            )
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error, size: 48),
                        const SizedBox(height: 16),
                        Text(_errorMessage!, style: const TextStyle(color: Colors.white, fontSize: 15)),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadBookingDetails,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : booking == null
                  ? const SizedBox()
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Success Alert
                          if (_checkoutSuccessMessage != null)
                            Container(
                              key: const Key('checkout_success_banner'),
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFF10B981)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      _checkoutSuccessMessage!,
                                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                          // Error Alert
                          if (_checkoutError != null)
                            Container(
                              key: const Key('checkout_error_banner'),
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.error.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.error),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      _checkoutError!,
                                      style: const TextStyle(color: AppColors.error, fontSize: 13),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                          // Booking Header Card
                          _buildBookingHeaderCard(booking),
                          const SizedBox(height: 16),

                          // Quotation Line Items Card
                          _buildLineItemsCard(booking),
                          const SizedBox(height: 16),

                          // Payment Summary & Policy Card
                          _buildPaymentDueCard(booking),
                          const SizedBox(height: 16),

                          // Payment Processing & Settlement Disclosure
                          _buildPaymentDisclosureNotice(booking),
                          const SizedBox(height: 16),

                          // Paid Transaction Reference Card if paid
                          if (booking.isPaid) ...[
                            _buildPaidDetailsCard(booking),
                            const SizedBox(height: 16),
                            _buildDeliveryProgressCard(booking),
                          ],
                        ],
                      ),
                    ),
      bottomNavigationBar: _booking != null ? _buildBottomBar(_booking!) : null,
    );
  }

  Widget _buildBookingHeaderCard(BookingModel booking) {
    final dateFormatted = DateFormat('EEE, dd MMM yyyy').format(booking.bookingDate.toDate());

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Booking #${booking.bookingId.length > 8 ? booking.bookingId.substring(0, 8).toUpperCase() : booking.bookingId.toUpperCase()}',
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              _buildPaymentStatusBadge(booking.paymentStatus),
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
              const SizedBox(width: 16),
              const Icon(Icons.storefront_rounded, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(booking.vendorId.isNotEmpty ? booking.vendorId : 'Partner Service',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLineItemsCard(BookingModel booking) {
    final quote = _quotation;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ITEMIZED QUOTATION',
                style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.0),
              ),
              if (quote != null)
                Text(
                  'Quote #${quote.quotationId.substring(0, 8).toUpperCase()}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: AppColors.glassBorder, height: 1),
          const SizedBox(height: 12),

          if (quote != null && quote.lineItems.isNotEmpty) ...[
            ...quote.lineItems.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.description, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
                            Text('${item.quantity} × ${item.formattedUnitPrice}',
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                          ],
                        ),
                      ),
                      Text(item.formattedTotal, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                    ],
                  ),
                )),
            const SizedBox(height: 8),
            const Divider(color: AppColors.glassBorder, height: 1),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Subtotal', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                Text(quote.formattedSubtotal, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Tax / GST', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                Text(quote.formattedTax, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
            if (quote.inclusions.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Inclusions:', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(quote.inclusions.join(' • '), style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
            ],
          ] else ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Confirmed Service Booking', style: TextStyle(color: Colors.white, fontSize: 13)),
                  Text(_formatAmount(booking.amount), style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaymentDueCard(BookingModel booking) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Payment Schedule', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('100% Full Obligation',
                    style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total Agreed Amount', style: TextStyle(color: Colors.white70, fontSize: 13)),
              Text(_formatAmount(booking.amount), style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(color: AppColors.glassBorder, height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'AMOUNT DUE NOW',
                style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
              ),
              Text(
                booking.isPaid ? '₹0.00' : _formatAmount(booking.amount),
                style: const TextStyle(color: AppColors.primary, fontSize: 20, fontWeight: FontWeight.w900),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentDisclosureNotice(BookingModel booking) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.info_outline_rounded, color: AppColors.primary, size: 18),
              SizedBox(width: 8),
              Text(
                'Payment & Settlement Disclosure',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _buildDisclosureItem(
            'Verification Status',
            booking.isPaid
                ? 'Payment authorization has been cryptographically verified on the server.'
                : 'Pending checkout. Server cryptographically verifies signatures before confirming.',
          ),
          const SizedBox(height: 8),
          _buildDisclosureItem(
            'Sandbox Simulation vs Real Money',
            'Test-mode sandbox transactions simulate gateway responses for validation and do not transfer real fiat funds.',
          ),
          const SizedBox(height: 8),
          _buildDisclosureItem(
            'Settlement Ledger',
            'Confirmed payments update internal allocation ledger records tracking vendor balances.',
          ),
          const SizedBox(height: 8),
          _buildDisclosureItem(
            'External Disbursement',
            'Live bank payouts and legal escrow arrangements remain unconfigured; ledger balances do not constitute escrow deposits or external bank disbursement.',
          ),
        ],
      ),
    );
  }

  Widget _buildDisclosureItem(String label, String detail) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.primary,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          detail,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 10.5,
            height: 1.35,
          ),
        ),
      ],
    );
  }

  Widget _buildPaidDetailsCard(BookingModel booking) {
    final pay = _paymentRecord;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF10B981).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 18),
              SizedBox(width: 8),
              Text('Payment Verified & Recorded on Ledger',
                  style: TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 10),
          if (pay != null) ...[
            Text('Transaction ID: ${pay['transactionId'] ?? pay['paymentId'] ?? 'N/A'}',
                style: const TextStyle(color: Colors.white70, fontSize: 11)),
            const SizedBox(height: 4),
            Text('Payment Method: ${(pay['paymentMethod'] as String? ?? 'Razorpay').toUpperCase()}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
          ],
        ],
      ),
    );
  }

  Widget _buildDeliveryProgressCard(BookingModel booking) {
    final status = booking.fulfillmentStatus;
    final milestones = booking.fulfillmentMilestones;

    return Container(
      key: const Key('customer_delivery_progress_card'),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.local_shipping_outlined, color: AppColors.primary, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'SERVICE DELIVERY PROGRESS',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: booking.isCompleted
                      ? const Color(0xFF10B981).withValues(alpha: 0.15)
                      : AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: booking.isCompleted ? const Color(0xFF10B981) : AppColors.primary,
                  ),
                ),
                child: Text(
                  status.replaceAll('_', ' ').toUpperCase(),
                  style: TextStyle(
                    color: booking.isCompleted ? const Color(0xFF10B981) : AppColors.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildProgressStepper(status),
          if (milestones.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Divider(color: Colors.white10),
            const SizedBox(height: 8),
            const Text(
              'Milestone Activity Log',
              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ...milestones.map((m) {
              final msName = (m['milestone'] as String? ?? '').replaceAll('_', ' ').toUpperCase();
              final notes = m['notes'] as String?;
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.circle, size: 6, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        notes != null && notes.isNotEmpty ? '$msName: $notes' : msName,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _buildProgressStepper(String currentStatus) {
    final stages = [
      {
        'key': 'prep',
        'label': 'Preparation',
        'active': [
          'prep_started',
          'setup_in_progress',
          'setup_completed',
          'delivered',
          'review_pending',
          'completed'
        ].contains(currentStatus)
      },
      {
        'key': 'setup',
        'label': 'Setup',
        'active': [
          'setup_in_progress',
          'setup_completed',
          'delivered',
          'review_pending',
          'completed'
        ].contains(currentStatus)
      },
      {
        'key': 'delivered',
        'label': 'Delivered',
        'active': ['delivered', 'review_pending', 'completed'].contains(currentStatus)
      },
      {'key': 'completed', 'label': 'Verified', 'active': currentStatus == 'completed'},
    ];

    return Row(
      children: stages.asMap().entries.map((entry) {
        final idx = entry.key;
        final stage = entry.value;
        final isActive = stage['active'] as bool;
        final isLast = idx == stages.length - 1;

        return Expanded(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.primary : Colors.white10,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Icon(
                          isActive ? Icons.check : Icons.circle,
                          size: 12,
                          color: isActive ? Colors.black : Colors.white24,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      stage['label'] as String,
                      style: TextStyle(
                        color: isActive ? Colors.white : Colors.white38,
                        fontSize: 9,
                        fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              if (!isLast)
                Container(
                  width: 14,
                  height: 2,
                  color: isActive ? AppColors.primary : Colors.white10,
                  margin: const EdgeInsets.only(bottom: 14),
                ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildBottomBar(BookingModel booking) {
    if (booking.isPaid) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 18),
            const SizedBox(width: 8),
            Text(
              'PAYMENT CONFIRMED (${_formatAmount(booking.amount)})',
              style: const TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
      ),
      child: ElevatedButton.icon(
        key: const Key('initiate_checkout_button'),
        onPressed: _isProcessingPayment ? null : _initiateCheckout,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        icon: _isProcessingPayment
            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
            : const Icon(Icons.lock_outline_rounded, size: 18),
        label: Text(
          _isProcessingPayment ? 'Processing Checkout...' : 'Pay Now via Razorpay (${_formatAmount(booking.amount)})',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
        ),
      ),
    );
  }

  Widget _buildPaymentStatusBadge(String status) {
    final isPaid = status.toLowerCase() == 'paid';
    final color = isPaid ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    final label = isPaid ? 'PAID' : 'PAYMENT DUE';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5),
      ),
    );
  }
}

/// Simulated Razorpay Checkout Dialog for testing & sandbox execution.
class _RazorpayCheckoutModal extends StatefulWidget {
  final String orderId;
  final int amountPaise;
  final bool isTestMode;
  final PaymentApiService apiService;

  const _RazorpayCheckoutModal({
    required this.orderId,
    required this.amountPaise,
    required this.isTestMode,
    required this.apiService,
  });

  @override
  State<_RazorpayCheckoutModal> createState() => _RazorpayCheckoutModalState();
}

class _RazorpayCheckoutModalState extends State<_RazorpayCheckoutModal> {
  String _selectedMethod = 'upi';
  bool _isSubmitting = false;

  String get _formattedAmount {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(widget.amountPaise / 100.0)}';
  }

  Future<void> _handleSimulateSuccess() async {
    setState(() => _isSubmitting = true);
    try {
      final sim = await widget.apiService.simulateSandboxPayment(orderId: widget.orderId);
      if (mounted) {
        Navigator.of(context).pop({
          'status': 'success',
          'razorpay_order_id': sim['razorpay_order_id'],
          'razorpay_payment_id': sim['razorpay_payment_id'],
          'razorpay_signature': sim['razorpay_signature'],
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        Navigator.of(context).pop({
          'status': 'failed',
          'error': e.toString().replaceFirst('Exception: ', ''),
        });
      }
    }
  }

  Future<void> _handleSimulateFailure() async {
    setState(() => _isSubmitting = true);
    try {
      await widget.apiService.simulateSandboxFailure(
        orderId: widget.orderId,
        reason: 'Payment declined: Insufficient funds (Sandbox simulation)',
      );
      if (mounted) {
        Navigator.of(context).pop({
          'status': 'failed',
          'error': 'Payment declined: Insufficient funds (Sandbox simulation)',
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        Navigator.of(context).pop({
          'status': 'failed',
          'error': e.toString().replaceFirst('Exception: ', ''),
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.payment_rounded, color: Colors.blue, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Razorpay Secure Checkout',
                            style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.isTestMode) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: Colors.orange.withValues(alpha: 0.4)),
                      ),
                      child: const Text('TEST MODE', style: TextStyle(color: Colors.orange, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              const Divider(color: AppColors.glassBorder, height: 1),
              const SizedBox(height: 16),

              // Payable Amount Callout
              Center(
                child: Column(
                  children: [
                    const Text('Amount Payable', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                    const SizedBox(height: 4),
                    Text(_formattedAmount,
                        style: const TextStyle(color: AppColors.primary, fontSize: 24, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('Order Reference: ${widget.orderId}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 10)),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              const Text('Select Payment Method', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),

              // Payment options
              _buildMethodOption('upi', 'UPI / QR Code', Icons.qr_code_2_rounded),
              _buildMethodOption('card', 'Credit / Debit Card', Icons.credit_card_rounded),
              _buildMethodOption('netbanking', 'Net Banking', Icons.account_balance_rounded),

              const SizedBox(height: 20),
              const Divider(color: AppColors.glassBorder, height: 1),
              const SizedBox(height: 16),

              // Actions
              if (_isSubmitting)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                )
              else ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    key: const Key('simulate_checkout_success_btn'),
                    onPressed: _handleSimulateSuccess,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: Text('Complete Payment ($_formattedAmount)', style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        key: const Key('simulate_checkout_decline_btn'),
                        onPressed: _handleSimulateFailure,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.error,
                          side: const BorderSide(color: AppColors.error),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('Simulate Decline', style: TextStyle(fontSize: 11)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextButton(
                        key: const Key('cancel_checkout_btn'),
                        onPressed: () => Navigator.of(context).pop(null),
                        child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMethodOption(String key, String title, IconData icon) {
    final isSelected = _selectedMethod == key;

    return InkWell(
      onTap: () => setState(() => _selectedMethod = key),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withValues(alpha: 0.1) : AppColors.surfaceLighter,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.glassBorder),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: isSelected ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(title, style: TextStyle(color: isSelected ? Colors.white : Colors.white70, fontSize: 12)),
            ),
            if (isSelected) const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 16),
          ],
        ),
      ),
    );
  }
}
