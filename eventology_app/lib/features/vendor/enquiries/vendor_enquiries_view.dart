import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../vendor_session.dart';
import '../../../services/firestore/enquiries_repository.dart';
import '../../../models/enquiries_model.dart';
import '../../../models/quotations_model.dart';
import '../../../services/quotation_api_service.dart';

class VendorEnquiriesView extends StatefulWidget {
  final QuotationApiService? apiService;
  final Stream<List<EnquiryModel>>? enquiryStream;

  const VendorEnquiriesView({
    super.key,
    this.apiService,
    this.enquiryStream,
  });

  @override
  State<VendorEnquiriesView> createState() => _VendorEnquiriesViewState();
}

class _VendorEnquiriesViewState extends State<VendorEnquiriesView> {
  String _filter = 'pending'; // 'pending', 'vendor_accepted', 'accepted', 'declined'
  late final QuotationApiService _api;

  @override
  void initState() {
    super.initState();
    _api = widget.apiService ?? QuotationApiService();
  }

  @override
  Widget build(BuildContext context) {
    String vendorId = '';
    try {
      final vendor = VendorSession.of(context);
      vendorId = vendor.id;
    } catch (_) {}

    // Allow testing when enquiryStream is injected or vendor is present
    if (widget.enquiryStream == null &&
        (vendorId.trim().isEmpty || vendorId == 'test_vendor_id')) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Text(
            'No valid vendor profile linked to this session.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background.withValues(alpha: 0.95),
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'Enquiries & Quotations',
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
            child: StreamBuilder<List<EnquiryModel>>(
              stream: widget.enquiryStream ??
                  EnquiriesRepository.streamVendorEnquiries(vendorId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  );
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Text(
                      'Error loading enquiries: ${snapshot.error}',
                      style: const TextStyle(color: AppColors.error),
                    ),
                  );
                }

                final allEnquiries = snapshot.data ?? [];
                final filtered = allEnquiries.where((e) {
                  if (_filter == 'all') return true;
                  return e.status == _filter;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.assignment_outlined,
                            size: 64, color: Colors.white24),
                        const SizedBox(height: 16),
                        Text(
                          'No ${_filter.replaceAll('_', ' ')} enquiries.',
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.only(
                      left: 16, right: 16, top: 16, bottom: 120),
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

  Widget _buildFilterTabs() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.white10)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildTab('Pending', 'pending'),
            const SizedBox(width: 8),
            _buildTab('Quoted', 'vendor_accepted'),
            const SizedBox(width: 8),
            _buildTab('Booked', 'accepted'),
            const SizedBox(width: 8),
            _buildTab('Declined', 'declined'),
            const SizedBox(width: 8),
            _buildTab('All', 'all'),
          ],
        ),
      ),
    );
  }

  Widget _buildTab(String label, String status) {
    final isSelected = _filter == status;
    return GestureDetector(
      onTap: () => setState(() => _filter = status),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withValues(alpha: 0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary.withValues(alpha: 0.6) : Colors.white12,
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

  Widget _buildEnquiryCard(BuildContext context, EnquiryModel enquiry) {
    final reqs = enquiry.requirements ?? {};
    final guestCount = reqs['guestCount'];
    final venueName = reqs['venueName'] ?? reqs['location'];

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
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
                'Enquiry #${enquiry.id.length >= 8 ? enquiry.id.substring(0, 8) : enquiry.id}',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
              ),
              _buildStatusBadge(enquiry.status),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                DateFormat('MMM dd, yyyy').format(enquiry.targetDate.toDate()),
                style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w500),
              ),
              if (guestCount != null) ...[
                const SizedBox(width: 16),
                const Icon(Icons.people_outline_rounded, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  '$guestCount Guests',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
              if (venueName != null) ...[
                const SizedBox(width: 16),
                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  venueName.toString(),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceLighter,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white10),
            ),
            child: Text(
              enquiry.message.isNotEmpty ? enquiry.message : 'No custom message provided.',
              style: const TextStyle(fontSize: 13, color: Colors.white70, height: 1.4),
            ),
          ),
          const SizedBox(height: 14),

          // Action buttons depending on state
          if (enquiry.status == 'pending') ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    key: Key('decline_button_${enquiry.id}'),
                    onPressed: () => _declineEnquiry(enquiry.id),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.white24),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    key: Key('create_quote_button_${enquiry.id}'),
                    icon: const Icon(Icons.request_quote_rounded, size: 18),
                    label: const Text('Send Quotation', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.background,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => _openQuotationDialog(context, enquiry),
                  ),
                ),
              ],
            ),
          ] else if (enquiry.status == 'vendor_accepted') ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    key: Key('view_quote_button_${enquiry.id}'),
                    icon: const Icon(Icons.visibility_outlined, size: 16),
                    label: const Text('View Submitted Quote'),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: AppColors.primary.withValues(alpha: 0.5)),
                      foregroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => _viewQuotations(context, enquiry.id),
                  ),
                ),
              ],
            ),
          ] else if (enquiry.status == 'accepted') ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Quotation accepted by customer! Confirmed booking created in your Bookings tab.',
                      style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color textColor;
    Color bgColor;
    String label;

    switch (status.toLowerCase()) {
      case 'accepted':
        textColor = const Color(0xFF10B981);
        bgColor = const Color(0xFF10B981).withValues(alpha: 0.15);
        label = 'BOOKED';
        break;
      case 'vendor_accepted':
        textColor = AppColors.primary;
        bgColor = AppColors.primary.withValues(alpha: 0.15);
        label = 'QUOTED';
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
        borderRadius: BorderRadius.circular(6),
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

  void _declineEnquiry(String enquiryId) async {
    try {
      await EnquiriesRepository.declineEnquiry(enquiryId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enquiry declined.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _openQuotationDialog(BuildContext context, EnquiryModel enquiry) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => VendorQuotationDialog(
        enquiry: enquiry,
        apiService: _api,
        onSuccess: () {
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Quotation sent to client successfully!')),
          );
        },
      ),
    );
  }

  void _viewQuotations(BuildContext context, String enquiryId) async {
    showDialog(
      context: context,
      builder: (ctx) => FutureBuilder<List<QuotationModel>>(
        future: _api.fetchQuotationsForEnquiry(enquiryId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          if (snapshot.hasError) {
            return AlertDialog(
              backgroundColor: AppColors.surface,
              title: const Text('Error', style: TextStyle(color: Colors.white)),
              content: Text(snapshot.error.toString(), style: const TextStyle(color: AppColors.textSecondary)),
              actions: [
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
              ],
            );
          }

          final quotations = snapshot.data ?? [];
          if (quotations.isEmpty) {
            return AlertDialog(
              backgroundColor: AppColors.surface,
              title: const Text('No Quotations Found', style: TextStyle(color: Colors.white)),
              content: const Text('No submitted quotation exists for this enquiry.',
                  style: TextStyle(color: AppColors.textSecondary)),
              actions: [
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
              ],
            );
          }

          final q = quotations.first;
          return AlertDialog(
            backgroundColor: AppColors.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Submitted Quotation', style: TextStyle(color: Colors.white, fontSize: 16)),
                Text(q.status.toUpperCase(),
                    style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
            content: SizedBox(
              width: 450,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Total Amount: ${q.formattedTotal}',
                        style: const TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text('Subtotal: ${q.formattedSubtotal} • Tax: ${q.formattedTax}',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    const SizedBox(height: 12),
                    const Divider(color: Colors.white10),
                    const Text('Line Items:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    ...q.lineItems.map((item) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text('${item.quantity}x ${item.description}',
                                    style: const TextStyle(color: Colors.white70, fontSize: 13)),
                              ),
                              Text(item.formattedTotal,
                                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
                            ],
                          ),
                        )),
                    if (q.inclusions.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text('Inclusions:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(q.inclusions.join(', '), style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    ],
                    if (q.notes != null) ...[
                      const SizedBox(height: 12),
                      const Text('Notes:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 4),
                      Text(q.notes!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    ],
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
            ],
          );
        },
      ),
    );
  }
}

class VendorQuotationDialog extends StatefulWidget {
  final EnquiryModel enquiry;
  final QuotationApiService apiService;
  final VoidCallback onSuccess;

  const VendorQuotationDialog({
    super.key,
    required this.enquiry,
    required this.apiService,
    required this.onSuccess,
  });

  @override
  State<VendorQuotationDialog> createState() => _VendorQuotationDialogState();
}

class _VendorQuotationDialogState extends State<VendorQuotationDialog> {
  final _formKey = GlobalKey<FormState>();
  final List<Map<String, dynamic>> _lineItems = [
    {'desc': TextEditingController(), 'qty': TextEditingController(text: '1'), 'rate': TextEditingController()}
  ];
  final _taxController = TextEditingController(text: '0');
  final _inclusionsController = TextEditingController();
  final _exclusionsController = TextEditingController();
  final _notesController = TextEditingController();
  int _validityDays = 7;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    for (final item in _lineItems) {
      item['desc'].dispose();
      item['qty'].dispose();
      item['rate'].dispose();
    }
    _taxController.dispose();
    _inclusionsController.dispose();
    _exclusionsController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  int get _subtotalPaise {
    int sum = 0;
    for (final item in _lineItems) {
      final qty = int.tryParse(item['qty'].text.trim()) ?? 0;
      final rateRupees = double.tryParse(item['rate'].text.trim()) ?? 0.0;
      final ratePaise = (rateRupees * 100).round();
      sum += qty * ratePaise;
    }
    return sum;
  }

  int get _taxPaise {
    final taxRupees = double.tryParse(_taxController.text.trim()) ?? 0.0;
    return (taxRupees * 100).round();
  }

  int get _totalAmountPaise => _subtotalPaise + _taxPaise;

  String _formatPaise(int paise) {
    final formatter = NumberFormat('#,##,##0.00', 'en_IN');
    return '₹${formatter.format(paise / 100.0)}';
  }

  void _addLineItem() {
    setState(() {
      _lineItems.add({
        'desc': TextEditingController(),
        'qty': TextEditingController(text: '1'),
        'rate': TextEditingController()
      });
    });
  }

  void _removeLineItem(int index) {
    if (_lineItems.length > 1) {
      setState(() {
        _lineItems[index]['desc'].dispose();
        _lineItems[index]['qty'].dispose();
        _lineItems[index]['rate'].dispose();
        _lineItems.removeAt(index);
      });
    }
  }

  Future<void> _submitQuotation() async {
    if (_isSubmitting) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final computedItems = _lineItems.map((item) {
        final qty = int.parse(item['qty'].text.trim());
        final rateRupees = double.parse(item['rate'].text.trim());
        final ratePaise = (rateRupees * 100).round();
        return QuotationLineItemModel(
          description: item['desc'].text.trim(),
          quantity: qty,
          unitPricePaise: ratePaise,
          totalPaise: qty * ratePaise,
        );
      }).toList();

      final inclusions = _inclusionsController.text
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.isNotEmpty)
          .toList();
      final exclusions = _exclusionsController.text
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.isNotEmpty)
          .toList();

      await widget.apiService.submitQuotation(
        enquiryId: widget.enquiry.id,
        lineItems: computedItems,
        taxPaise: _taxPaise,
        inclusions: inclusions,
        exclusions: exclusions,
        notes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
        validityDays: _validityDays,
      );

      if (mounted) {
        Navigator.of(context).pop();
        widget.onSuccess();
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
    return AlertDialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Create Structured Quotation', style: TextStyle(color: Colors.white, fontSize: 16)),
      content: SizedBox(
        width: 500,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.error.withValues(alpha: 0.4)),
                    ),
                    child: Text(_errorMessage!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                  ),
                const Text('Line Items', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                ..._lineItems.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final item = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            key: Key('item_desc_$idx'),
                            controller: item['desc'],
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Item Description',
                              labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              isDense: true,
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 1,
                          child: TextFormField(
                            key: Key('item_qty_$idx'),
                            controller: item['qty'],
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Qty',
                              labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              isDense: true,
                            ),
                            validator: (v) {
                              final n = int.tryParse(v?.trim() ?? '');
                              if (n == null || n <= 0) return 'Invalid';
                              return null;
                            },
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            key: Key('item_rate_$idx'),
                            controller: item['rate'],
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(
                              labelText: 'Rate (₹)',
                              labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              isDense: true,
                            ),
                            validator: (v) {
                              final n = double.tryParse(v?.trim() ?? '');
                              if (n == null || n < 0) return 'Invalid';
                              return null;
                            },
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        if (_lineItems.length > 1)
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, color: AppColors.error, size: 20),
                            onPressed: () => _removeLineItem(idx),
                          ),
                      ],
                    ),
                  );
                }),
                TextButton.icon(
                  key: const Key('add_line_item_button'),
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Another Item'),
                  onPressed: _addLineItem,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        key: const Key('tax_input'),
                        controller: _taxController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(
                          labelText: 'GST / Tax (₹)',
                          labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          isDense: true,
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: _validityDays,
                        dropdownColor: AppColors.surface,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(
                          labelText: 'Validity',
                          labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          isDense: true,
                        ),
                        items: const [
                          DropdownMenuItem(value: 3, child: Text('3 Days')),
                          DropdownMenuItem(value: 7, child: Text('7 Days')),
                          DropdownMenuItem(value: 14, child: Text('14 Days')),
                          DropdownMenuItem(value: 30, child: Text('30 Days')),
                        ],
                        onChanged: (v) => setState(() => _validityDays = v ?? 7),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('inclusions_input'),
                  controller: _inclusionsController,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                    labelText: 'Inclusions (comma separated)',
                    labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  key: const Key('notes_input'),
                  controller: _notesController,
                  maxLines: 2,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                    labelText: 'Notes / Assumptions',
                    labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLighter,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Subtotal:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          Text(_formatPaise(_subtotalPaise), style: const TextStyle(color: Colors.white, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Tax:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          Text(_formatPaise(_taxPaise), style: const TextStyle(color: Colors.white, fontSize: 12)),
                        ],
                      ),
                      const Divider(color: Colors.white10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Total Payable:',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                          Text(_formatPaise(_totalAmountPaise),
                              style: const TextStyle(
                                  color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 16)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
        ),
        ElevatedButton(
          key: const Key('submit_quotation_button'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.background,
          ),
          onPressed: _isSubmitting ? null : _submitQuotation,
          child: _isSubmitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Send Quotation', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}

extension on Iterable<String> {
  Iterable<String> filter(bool Function(String) test) => where(test);
}
