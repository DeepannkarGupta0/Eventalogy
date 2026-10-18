import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/enquiries_model.dart';
import '../../services/firestore/enquiries_repository.dart';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../../core/firebase/firestore_config.dart';
import '../../core/database/collections.dart';

import 'package:intl/intl.dart';

class AdminEnquiriesTab extends StatefulWidget {
  const AdminEnquiriesTab({super.key});

  @override
  State<AdminEnquiriesTab> createState() => _AdminEnquiriesTabState();
}

class _AdminEnquiriesTabState extends State<AdminEnquiriesTab> {
  String _searchQuery = '';
  String _statusFilter = 'All';

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildFilters(),
        Expanded(
          child: StreamBuilder<List<EnquiryModel>>(
            stream: EnquiriesRepository.stream(),
            builder: (context, snapshot) {
              if (snapshot.hasError)
                return Center(child: Text('Error: ${snapshot.error}'));
              if (!snapshot.hasData)
                return const Center(child: CircularProgressIndicator());

              var items = snapshot.data!;

              if (_searchQuery.isNotEmpty) {
                items = items
                    .where(
                      (i) =>
                          i.message.toLowerCase().contains(
                            _searchQuery.toLowerCase(),
                          ) ||
                          i.enquiryId.toLowerCase().contains(
                            _searchQuery.toLowerCase(),
                          ),
                    )
                    .toList();
              }

              if (_statusFilter != 'All') {
                items = items
                    .where(
                      (i) =>
                          i.status.toLowerCase() == _statusFilter.toLowerCase(),
                    )
                    .toList();
              }

              if (items.isEmpty)
                return const Center(child: Text('No enquiries found.'));

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final item = items[index];
                  return _buildCard(item);
                },
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search by message or ID...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) => setState(() => _searchQuery = val),
            ),
          ),
          const SizedBox(width: 16),
          DropdownButton<String>(
            value: _statusFilter,
            items: [
              'All',
              'pending',
              'vendor_accepted',
              'declined',
              'sent',
              'cancelled',
            ].map((e) => DropdownMenuItem(value: e, child: Text(e == 'All' ? 'All' : e.replaceAll('_', ' ').toUpperCase()))).toList(),
            onChanged: (val) => setState(() => _statusFilter = val!),
          ),
          const SizedBox(width: 16),
          ElevatedButton.icon(
            icon: const Icon(Icons.add, color: AppColors.background),
            label: const Text(
              'New Enquiry',
              style: TextStyle(color: AppColors.background),
            ),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => _showDialog(null),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(EnquiryModel item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.glassBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'ENQ-${item.enquiryId.substring(0, 5).toUpperCase()}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  color: Colors.white,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.timer, color: AppColors.primary, size: 14),
                    const SizedBox(width: 6),
                    Text(
                      '2d 04h 12m Grace Period',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Details
          Text(
            'Event ID: ${item.eventId}   •   Customer: ${item.customerId}',
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Message: "${item.message}"',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 20),

          // Checklist Simulation
          const Text(
            'Requirements Checklist',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: Colors.white,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildCheckItem(
                item.serviceId == 'venue' || item.status == 'accepted',
                'Venue Confirmed',
              ),
              const SizedBox(width: 16),
              _buildCheckItem(item.status == 'accepted', 'Photography'),
              const SizedBox(width: 16),
              _buildCheckItem(false, 'Catering'),
            ],
          ),
          const SizedBox(height: 24),

          // Footer Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: item.status.toLowerCase() == 'pending'
                      ? Colors.orange.withOpacity(0.2)
                      : Colors.green.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  item.status.toUpperCase(),
                  style: TextStyle(
                    color: item.status.toLowerCase() == 'pending'
                        ? Colors.orange
                        : Colors.green,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit, color: Colors.white70),
                    onPressed: () => _showDialog(item),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete, color: Colors.redAccent),
                    onPressed: () => EnquiriesRepository.delete(item.enquiryId),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCheckItem(bool isChecked, String label) {
    return Row(
      children: [
        Icon(
          isChecked ? Icons.check_circle : Icons.radio_button_unchecked,
          color: isChecked ? Colors.green : AppColors.textSecondary,
          size: 16,
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: isChecked ? Colors.white : AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  void _showDialog(EnquiryModel? item) {
    showDialog(
      context: context,
      builder: (context) => EnquiryFormDialog(item: item),
    );
  }
}

class EnquiryFormDialog extends StatefulWidget {
  final EnquiryModel? item;
  final List<Map<String, dynamic>>? initialEvents;
  final List<Map<String, dynamic>>? initialVendors;
  final List<Map<String, dynamic>>? initialServices;
  final Future<void> Function(EnquiryModel item)? onSave;

  const EnquiryFormDialog({
    super.key,
    this.item,
    this.initialEvents,
    this.initialVendors,
    this.initialServices,
    this.onSave,
  });

  @override
  State<EnquiryFormDialog> createState() => _EnquiryFormDialogState();
}

class _EnquiryFormDialogState extends State<EnquiryFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _customerCtrl = TextEditingController();
  final _msgCtrl = TextEditingController();
  final _reqsCtrl = TextEditingController();

  String? _selectedEvent;
  String? _selectedVendor;
  String? _selectedService;
  String _status = 'pending';
  DateTime _reqDate = DateTime.now();

  List<Map<String, dynamic>> _events = [];
  List<Map<String, dynamic>> _vendors = [];
  List<Map<String, dynamic>> _services = [];
  bool _isLoadingData = true;

  bool get _isVenueEnquiry => widget.item?.requirements?['type'] == 'venue';

  @override
  void initState() {
    super.initState();
    if (widget.item != null) {
      _customerCtrl.text = widget.item!.customerId;
      _msgCtrl.text = widget.item!.message;
      _reqsCtrl.text = widget.item!.requirements?['notes'] ?? '';
      _status = widget.item!.status;
      _reqDate = widget.item!.requestedDate.toDate();
    }
    _fetchMasterData();
  }

  @override
  void dispose() {
    _customerCtrl.dispose();
    _msgCtrl.dispose();
    _reqsCtrl.dispose();
    super.dispose();
  }

  void _syncInitialSelections() {
    if (widget.item != null) {
      if (_events.any((e) => e['id'] == widget.item!.eventId)) {
        _selectedEvent = widget.item!.eventId;
      }
      if (_vendors.any((e) => e['id'] == widget.item!.vendorId)) {
        _selectedVendor = widget.item!.vendorId;
      }
      if (_services.any((e) => e['id'] == widget.item!.serviceId)) {
        _selectedService = widget.item!.serviceId;
      }
    }
  }

  Future<void> _fetchMasterData() async {
    if (widget.initialEvents != null ||
        widget.initialVendors != null ||
        widget.initialServices != null) {
      _events = widget.initialEvents ?? [];
      _vendors = widget.initialVendors ?? [];
      _services = widget.initialServices ?? [];
      _syncInitialSelections();
      if (mounted) setState(() => _isLoadingData = false);
      return;
    }

    try {
      final db = FirestoreConfig.instance;

      final evSnap = await db.collection(Collections.events).get();
      _events = evSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['title'] ?? d.id})
          .toList();

      final venSnap = await db.collection(Collections.vendors).get();
      _vendors = venSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['businessName'] ?? d.id})
          .toList();

      final srvSnap = await db.collection(Collections.services).get();
      _services = srvSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['name'] ?? d.id})
          .toList();

      _syncInitialSelections();
    } catch (e) {
      debugPrint('Error fetching master data: ');
    } finally {
      if (mounted) setState(() => _isLoadingData = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingData) {
      return const AlertDialog(
        content: SizedBox(
          height: 100,
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final String titleText;
    if (widget.item == null) {
      titleText = 'New Enquiry';
    } else if (_isVenueEnquiry) {
      titleText = 'Edit Venue Enquiry';
    } else {
      titleText = 'Edit Enquiry';
    }

    return AlertDialog(
      title: Text(titleText),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_isVenueEnquiry)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.location_city, color: Colors.amber, size: 22),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.item?.requirements?['venueName'] ??
                                  widget.item?.requirements?['venueId'] ??
                                  'Venue Enquiry',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            if (widget.item?.requirements?['guestCount'] != null)
                              Text(
                                'Guests: ${widget.item!.requirements!["guestCount"]}',
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              TextFormField(
                key: const Key('enquiry_customer_id_field'),
                controller: _customerCtrl,
                decoration: const InputDecoration(
                  labelText: 'Customer ID (User ID)',
                ),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              DropdownButtonFormField<String>(
                key: const Key('enquiry_event_dropdown'),
                value: _selectedEvent,
                decoration: InputDecoration(
                  labelText: _isVenueEnquiry ? 'Event (Optional for Venue)' : 'Event',
                ),
                items: _events
                    .map(
                      (e) => DropdownMenuItem<String>(
                        value: e['id'],
                        child: Text(e['name']),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _selectedEvent = v),
                validator: (v) {
                  if (_isVenueEnquiry) return null;
                  return (v == null || v.isEmpty) ? 'Required' : null;
                },
              ),
              DropdownButtonFormField<String>(
                key: const Key('enquiry_vendor_dropdown'),
                value: _selectedVendor,
                decoration: InputDecoration(
                  labelText: _isVenueEnquiry ? 'Vendor (N/A for Venue)' : 'Vendor',
                ),
                items: _vendors
                    .map(
                      (e) => DropdownMenuItem<String>(
                        value: e['id'],
                        child: Text(e['name']),
                      ),
                    )
                    .toList(),
                onChanged: _isVenueEnquiry ? null : (v) => setState(() => _selectedVendor = v),
                validator: (v) {
                  if (_isVenueEnquiry) return null;
                  return (v == null || v.isEmpty) ? 'Required' : null;
                },
              ),
              DropdownButtonFormField<String>(
                key: const Key('enquiry_service_dropdown'),
                value: _selectedService,
                decoration: InputDecoration(
                  labelText: _isVenueEnquiry ? 'Service (N/A for Venue)' : 'Service',
                ),
                items: _services
                    .map(
                      (e) => DropdownMenuItem<String>(
                        value: e['id'],
                        child: Text(e['name']),
                      ),
                    )
                    .toList(),
                onChanged: _isVenueEnquiry ? null : (v) => setState(() => _selectedService = v),
                validator: (v) {
                  if (_isVenueEnquiry) return null;
                  return (v == null || v.isEmpty) ? 'Required' : null;
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Requested Date'),
                subtitle: Text(DateFormat.yMMMd().format(_reqDate)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _reqDate,
                    firstDate: DateTime(2000),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) setState(() => _reqDate = picked);
                },
              ),
              TextFormField(
                key: const Key('enquiry_message_field'),
                controller: _msgCtrl,
                decoration: const InputDecoration(labelText: 'Message'),
                maxLines: 3,
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              DropdownButtonFormField<String>(
                key: const Key('enquiry_status_dropdown'),
                value: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: [
                  'pending',
                  'sent',
                  'responded',
                  'quoted',
                  'accepted',
                  'rejected',
                  'cancelled',
                ]
                    .map(
                      (e) => DropdownMenuItem(
                        value: e,
                        child: Text(e.toUpperCase()),
                      ),
                    )
                    .toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _status = v);
                },
              ),
              TextFormField(
                key: const Key('enquiry_requirements_field'),
                controller: _reqsCtrl,
                decoration: const InputDecoration(
                  labelText: 'Requirements/Notes (Optional)',
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          key: const Key('enquiry_save_button'),
          onPressed: _save,
          child: const Text('Save'),
        ),
      ],
    );
  }

  void _save() async {
    if (!_formKey.currentState!.validate()) return;

    final Map<String, dynamic> updatedRequirements =
        Map<String, dynamic>.from(widget.item?.requirements ?? {});
    final notes = _reqsCtrl.text.trim();
    if (notes.isNotEmpty) {
      updatedRequirements['notes'] = notes;
    } else {
      updatedRequirements.remove('notes');
    }

    final item = EnquiryModel(
      enquiryId: widget.item?.enquiryId ?? '',
      eventId: _selectedEvent ?? (_isVenueEnquiry ? (widget.item?.eventId ?? '') : ''),
      customerId: _customerCtrl.text.trim(),
      vendorId: _selectedVendor ?? (_isVenueEnquiry ? (widget.item?.vendorId ?? '') : ''),
      serviceId: _selectedService ?? (_isVenueEnquiry ? (widget.item?.serviceId ?? '') : ''),
      message: _msgCtrl.text.trim(),
      requirements: updatedRequirements.isEmpty ? null : updatedRequirements,
      requestedDate: Timestamp.fromDate(_reqDate),
      status: _status,
      createdAt: widget.item?.createdAt ?? Timestamp.now(),
    );

    try {
      if (widget.onSave != null) {
        await widget.onSave!(item);
      } else if (widget.item == null) {
        await EnquiriesRepository.create(item);
      } else {
        await EnquiriesRepository.update(item);
      }
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}
