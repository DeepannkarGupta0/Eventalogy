import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../models/rfq_model.dart';
import '../../../user/procurement/widgets/rfq_category_badge.dart';

class VendorQuotationSubmissionDialog extends StatefulWidget {
  final RfqPackageModel package;
  final String vendorId;
  final Future<void> Function({
    required int quotedAmountPaise,
    int? counterBidAmountPaise,
    List<RfqItemPriceModel>? itemPrices,
    String? notes,
    int? quoteValidityDays,
    String? deliveryCommitment,
  }) onSubmit;

  const VendorQuotationSubmissionDialog({
    super.key,
    required this.package,
    required this.vendorId,
    required this.onSubmit,
  });

  @override
  State<VendorQuotationSubmissionDialog> createState() =>
      _VendorQuotationSubmissionDialogState();
}

class _VendorQuotationSubmissionDialogState
    extends State<VendorQuotationSubmissionDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _totalQuoteController;
  late final TextEditingController _counterBidController;
  late final TextEditingController _notesController;
  late final TextEditingController _deliveryCommitmentController;
  final Map<String, TextEditingController> _itemPriceControllers = {};

  int _quoteValidityDays = 7;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final initialQuoteInr = widget.package.quotedAmountPaise != null
        ? (widget.package.quotedAmountPaise! / 100.0).toStringAsFixed(0)
        : (widget.package.estimatedTotalPaise / 100.0).toStringAsFixed(0);

    _totalQuoteController = TextEditingController(text: initialQuoteInr);

    final initialCounterInr = widget.package.counterBidAmountPaise != null
        ? (widget.package.counterBidAmountPaise! / 100.0).toStringAsFixed(0)
        : '';
    _counterBidController = TextEditingController(text: initialCounterInr);

    _notesController = TextEditingController(text: widget.package.notes ?? '');
    _deliveryCommitmentController =
        TextEditingController(text: widget.package.deliveryCommitment ?? '');

    if (widget.package.quoteValidityDays != null) {
      _quoteValidityDays = widget.package.quoteValidityDays!;
    }

    // Initialize item controllers
    for (final item in widget.package.lineItems) {
      final existingItemPrice = widget.package.itemPrices?.firstWhere(
        (ip) => ip.itemName == item.name,
        orElse: () => RfqItemPriceModel(
          itemName: item.name,
          quotedRatePaise: item.estimatedRatePaise,
        ),
      );

      final initialItemRateInr = existingItemPrice != null
          ? (existingItemPrice.quotedRatePaise / 100.0).toStringAsFixed(0)
          : (item.estimatedRatePaise / 100.0).toStringAsFixed(0);

      _itemPriceControllers[item.name] =
          TextEditingController(text: initialItemRateInr);
    }
  }

  @override
  void dispose() {
    _totalQuoteController.dispose();
    _counterBidController.dispose();
    _notesController.dispose();
    _deliveryCommitmentController.dispose();
    for (final c in _itemPriceControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _recalculateTotalFromItems() {
    int totalPaise = 0;
    for (final item in widget.package.lineItems) {
      final text = _itemPriceControllers[item.name]?.text.trim() ?? '0';
      final inr = double.tryParse(text) ?? 0.0;
      final itemRatePaise = (inr * 100).round();
      totalPaise += item.quantity * itemRatePaise;
    }
    if (totalPaise > 0) {
      setState(() {
        _totalQuoteController.text = (totalPaise / 100.0).toStringAsFixed(0);
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final quoteInr = double.tryParse(_totalQuoteController.text.trim());
    if (quoteInr == null || quoteInr <= 0) {
      setState(() => _errorMessage = 'Please enter a valid quoted total amount.');
      return;
    }

    final quotedAmountPaise = (quoteInr * 100).round();

    int? counterBidAmountPaise;
    final counterText = _counterBidController.text.trim();
    if (counterText.isNotEmpty) {
      final counterInr = double.tryParse(counterText);
      if (counterInr != null && counterInr > 0) {
        counterBidAmountPaise = (counterInr * 100).round();
      }
    }

    final List<RfqItemPriceModel> itemPrices = [];
    for (final item in widget.package.lineItems) {
      final text = _itemPriceControllers[item.name]?.text.trim();
      if (text != null && text.isNotEmpty) {
        final inr = double.tryParse(text);
        if (inr != null && inr >= 0) {
          itemPrices.add(
            RfqItemPriceModel(
              itemName: item.name,
              quotedRatePaise: (inr * 100).round(),
            ),
          );
        }
      }
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await widget.onSubmit(
        quotedAmountPaise: quotedAmountPaise,
        counterBidAmountPaise: counterBidAmountPaise,
        itemPrices: itemPrices.isNotEmpty ? itemPrices : null,
        notes: _notesController.text.trim().isNotEmpty
            ? _notesController.text.trim()
            : null,
        quoteValidityDays: _quoteValidityDays,
        deliveryCommitment: _deliveryCommitmentController.text.trim().isNotEmpty
            ? _deliveryCommitmentController.text.trim()
            : null,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final pkg = widget.package;

    return Dialog(
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.glassBorder),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 600, maxHeight: 780),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Modal Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              RfqCategoryBadge(
                                category: pkg.category,
                                compact: true,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'SUBMIT QUOTATION',
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.2,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            pkg.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white70),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const Divider(color: AppColors.glassBorder, height: 24),

                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: AppColors.error, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: AppColors.error, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Scrollable Body
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Line Items Pricing Table
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'EQUIPMENT LINE ITEMS (RATES)',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.0,
                              ),
                            ),
                            TextButton.icon(
                              onPressed: _recalculateTotalFromItems,
                              icon: const Icon(Icons.calculate_outlined, size: 14),
                              label: const Text(
                                'Sum to Total',
                                style: TextStyle(fontSize: 11),
                              ),
                              style: TextButton.styleFrom(
                                foregroundColor: AppColors.primary,
                                padding: EdgeInsets.zero,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        ...pkg.lineItems.map((item) {
                          final controller = _itemPriceControllers[item.name];

                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppColors.background.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.glassBorder),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.name,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Qty: ${item.quantity} ${item.unit}'
                                        '${item.specifications != null ? ' • ${item.specifications}' : ''}',
                                        style: const TextStyle(
                                          color: AppColors.textSecondary,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 2,
                                  child: TextFormField(
                                    controller: controller,
                                    keyboardType: TextInputType.number,
                                    inputFormatters: [
                                      FilteringTextInputFormatter.digitsOnly,
                                    ],
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                    ),
                                    decoration: InputDecoration(
                                      prefixText: '₹ ',
                                      prefixStyle: const TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 13,
                                      ),
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 8,
                                      ),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8),
                                        borderSide: const BorderSide(
                                            color: AppColors.glassBorder),
                                      ),
                                    ),
                                    onChanged: (_) => _recalculateTotalFromItems(),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                        const SizedBox(height: 16),

                        // Total Quoted Amount Field
                        const Text(
                          'TOTAL QUOTED AMOUNT (₹)',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _totalQuoteController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                          decoration: InputDecoration(
                            prefixIcon: const Icon(
                              Icons.currency_rupee,
                              color: AppColors.primary,
                              size: 18,
                            ),
                            filled: true,
                            fillColor: AppColors.background,
                            hintText: 'e.g. 52000',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: AppColors.glassBorder),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: AppColors.primary),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Quoted amount is required';
                            }
                            final num = double.tryParse(value.trim());
                            if (num == null || num <= 0) {
                              return 'Enter a positive amount';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Optional Counter-Bid Field
                        const Text(
                          'PROPOSED COUNTER-BID RATE (₹, OPTIONAL)',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _counterBidController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          style: const TextStyle(
                            color: Color(0xFFF59E0B),
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                          decoration: InputDecoration(
                            prefixIcon: const Icon(
                              Icons.swap_horiz_rounded,
                              color: Color(0xFFF59E0B),
                              size: 18,
                            ),
                            filled: true,
                            fillColor: AppColors.background,
                            hintText: 'Enter alternate package rate if adjusting scope',
                            hintStyle: TextStyle(
                              color:
                                  AppColors.textSecondary.withValues(alpha: 0.5),
                              fontSize: 12,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: AppColors.glassBorder),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Quote Validity Dropdown
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'QUOTE VALIDITY',
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1.0,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12),
                                    decoration: BoxDecoration(
                                      color: AppColors.background,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                          color: AppColors.glassBorder),
                                    ),
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButton<int>(
                                        value: _quoteValidityDays,
                                        isExpanded: true,
                                        dropdownColor: AppColors.surface,
                                        style: const TextStyle(
                                            color: Colors.white, fontSize: 13),
                                        items: const [
                                          DropdownMenuItem(
                                            value: 3,
                                            child: Text('3 Days'),
                                          ),
                                          DropdownMenuItem(
                                            value: 7,
                                            child: Text('7 Days (Recommended)'),
                                          ),
                                          DropdownMenuItem(
                                            value: 14,
                                            child: Text('14 Days'),
                                          ),
                                          DropdownMenuItem(
                                            value: 30,
                                            child: Text('30 Days'),
                                          ),
                                        ],
                                        onChanged: (val) {
                                          if (val != null) {
                                            setState(
                                                () => _quoteValidityDays = val);
                                          }
                                        },
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // Delivery Commitment Input
                        const Text(
                          'DELIVERY & LOGISTICS COMMITMENT',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _deliveryCommitmentController,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            hintText:
                                'e.g. Guaranteed on-site delivery 4 hours prior to soundcheck.',
                            hintStyle: TextStyle(
                              color:
                                  AppColors.textSecondary.withValues(alpha: 0.5),
                              fontSize: 12,
                            ),
                            filled: true,
                            fillColor: AppColors.background,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: AppColors.glassBorder),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Fulfillment Notes / Terms Input
                        const Text(
                          'TERMS & FULFILLMENT NOTES',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _notesController,
                          maxLines: 2,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            hintText:
                                'e.g. Includes setup, teardown & 2 dedicated audio technicians.',
                            hintStyle: TextStyle(
                              color:
                                  AppColors.textSecondary.withValues(alpha: 0.5),
                              fontSize: 12,
                            ),
                            filled: true,
                            fillColor: AppColors.background,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: AppColors.glassBorder),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),
                // Dialog Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _handleSubmit,
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.black,
                              ),
                            )
                          : const Icon(Icons.send_rounded, size: 16),
                      label: Text(
                        _isSubmitting ? 'Submitting...' : 'Submit Quotation',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
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
}
