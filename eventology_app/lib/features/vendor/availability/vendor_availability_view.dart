import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/vendor_availability_model.dart';
import '../../../services/availability_api_service.dart';
import '../vendor_session.dart';

class VendorAvailabilityView extends StatefulWidget {
  final String? testVendorId;
  final AvailabilityApiService? testApiService;

  const VendorAvailabilityView({
    super.key,
    this.testVendorId,
    this.testApiService,
  });

  @override
  State<VendorAvailabilityView> createState() => _VendorAvailabilityViewState();
}

class _VendorAvailabilityViewState extends State<VendorAvailabilityView> {
  late final AvailabilityApiService _apiService;
  VendorAvailabilityModel? _config;
  List<VendorCommitmentModel> _commitments = [];
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  // Form State
  late List<int> _selectedDays;
  late String _openTime;
  late String _closeTime;
  late int _setupBufferMinutes;
  late int _teardownBufferMinutes;
  late String _capacityType;
  late int _defaultCapacity;
  late List<BlackoutDateModel> _blackoutDates;

  final List<String> _timeOptions = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
  ];

  final List<int> _bufferOptions = [0, 30, 60, 90, 120, 180];

  final Map<String, String> _capacityLabels = {
    'events_count': 'Simultaneous Events (Max Concurrent Bookings)',
    'units_inventory': 'Equipment / Inventory Units',
    'staff_personnel': 'Staff / Crew Personnel Count',
    'attendees': 'Guest / Attendee Capacity',
  };

  @override
  void initState() {
    super.initState();
    _apiService = widget.testApiService ?? AvailabilityApiService();
    _initDefaults();
    _loadData();
  }

  void _initDefaults() {
    _selectedDays = [1, 2, 3, 4, 5, 6];
    _openTime = '09:00';
    _closeTime = '21:00';
    _setupBufferMinutes = 60;
    _teardownBufferMinutes = 60;
    _capacityType = 'events_count';
    _defaultCapacity = 1;
    _blackoutDates = [];
  }

  String _resolveVendorId() {
    if (widget.testVendorId != null && widget.testVendorId!.isNotEmpty) {
      return widget.testVendorId!;
    }
    try {
      final vendor = VendorSession.of(context);
      return vendor.vendorId;
    } catch (_) {
      return '';
    }
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final vendorId = _resolveVendorId();
    if (vendorId.isEmpty) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'No active vendor business session found.';
      });
      return;
    }

    try {
      final config = await _apiService.fetchAvailability(vendorId);
      final commitments = await _apiService.fetchCommitments(vendorId, limit: 20);

      if (mounted) {
        setState(() {
          _config = config;
          _selectedDays = List<int>.from(config.operatingDays);
          _openTime = config.operatingHours.open;
          _closeTime = config.operatingHours.close;
          _setupBufferMinutes = config.setupBufferMinutes;
          _teardownBufferMinutes = config.teardownBufferMinutes;
          _capacityType = config.capacityType;
          _defaultCapacity = config.defaultCapacity;
          _blackoutDates = List<BlackoutDateModel>.from(config.blackoutDates);
          _commitments = commitments;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  void _applyQuickSetup() {
    setState(() {
      _selectedDays = [1, 2, 3, 4, 5, 6]; // Mon-Sat
      _openTime = '09:00';
      _closeTime = '21:00';
      _setupBufferMinutes = 60;
      _teardownBufferMinutes = 60;
      _capacityType = 'events_count';
      _defaultCapacity = 1;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Applied standard schedule (Mon-Sat 9 AM - 9 PM, 1 concurrent event). Tap "Save Configuration" to apply.'),
        backgroundColor: AppColors.primary,
        duration: Duration(seconds: 3),
      ),
    );
  }

  Future<void> _saveConfiguration() async {
    if (_selectedDays.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one regular operating day.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final vendorId = _resolveVendorId();
    if (vendorId.isEmpty) return;

    setState(() => _isSaving = true);

    try {
      final updatedModel = VendorAvailabilityModel(
        vendorId: vendorId,
        isConfigured: true,
        timezone: _config?.timezone ?? 'Asia/Kolkata',
        operatingDays: _selectedDays,
        operatingHours: OperatingHoursModel(open: _openTime, close: _closeTime),
        setupBufferMinutes: _setupBufferMinutes,
        teardownBufferMinutes: _teardownBufferMinutes,
        capacityType: _capacityType,
        defaultCapacity: _defaultCapacity,
        blackoutDates: _blackoutDates,
      );

      final saved = await _apiService.saveAvailability(vendorId, updatedModel);
      if (mounted) {
        setState(() {
          _config = saved;
          _isSaving = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Availability configuration saved successfully!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _showAddBlackoutDialog() {
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final dateStr = DateFormat('yyyy-MM-dd').format(selectedDate);
          return AlertDialog(
            backgroundColor: AppColors.surface,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppColors.glassBorder),
            ),
            title: const Row(
              children: [
                Icon(Icons.event_busy_rounded, color: AppColors.error, size: 22),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Add Blackout Date',
                    style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Select date to mark vendor unavailable for all new bookings and quotations:',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Blackout Date', style: TextStyle(color: Colors.white, fontSize: 13)),
                    subtitle: Text(
                      DateFormat('EEE, dd MMM yyyy').format(selectedDate),
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                    trailing: const Icon(Icons.calendar_month, color: AppColors.primary),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 730)),
                        builder: (context, child) {
                          return Theme(
                            data: ThemeData.dark().copyWith(
                              colorScheme: const ColorScheme.dark(
                                primary: AppColors.primary,
                                surface: AppColors.surface,
                              ),
                            ),
                            child: child!,
                          );
                        },
                      );
                      if (picked != null) {
                        setDialogState(() => selectedDate = picked);
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  const Text('Reason (Optional):', style: TextStyle(color: Colors.white, fontSize: 12)),
                  const SizedBox(height: 4),
                  TextField(
                    key: const Key('blackout_reason_input'),
                    controller: reasonController,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'e.g., Festival holiday, annual maintenance, vacation...',
                      hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                      filled: true,
                      fillColor: AppColors.surfaceLighter,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
              ),
              ElevatedButton(
                key: const Key('confirm_add_blackout_btn'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  final newBlackout = BlackoutDateModel(
                    date: dateStr,
                    reason: reasonController.text.trim().isNotEmpty ? reasonController.text.trim() : null,
                    isAllDay: true,
                  );
                  setState(() {
                    _blackoutDates.removeWhere((b) => b.date == dateStr);
                    _blackoutDates.add(newBlackout);
                    _blackoutDates.sort((a, b) => a.date.compareTo(b.date));
                  });
                  Navigator.of(ctx).pop();
                },
                child: const Text('Add Blackout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _removeBlackout(String dateStr) {
    setState(() {
      _blackoutDates.removeWhere((b) => b.date == dateStr);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.calendar_today_rounded, color: AppColors.primary, size: 20),
            SizedBox(width: 8),
            Text(
              'Availability & Calendar',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: _isLoading || _errorMessage != null
          ? null
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.glassBorder)),
              ),
              child: ElevatedButton(
                key: const Key('save_availability_btn'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isSaving ? null : _saveConfiguration,
                child: _isSaving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                      )
                    : const Text(
                        'Save Availability Configuration',
                        style: TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
              ),
            ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _loadData,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStatusBanner(),
          const SizedBox(height: 20),
          _buildOperatingDaysCard(),
          const SizedBox(height: 16),
          _buildOperatingHoursCard(),
          const SizedBox(height: 16),
          _buildCapacityCard(),
          const SizedBox(height: 16),
          _buildBlackoutCard(),
          const SizedBox(height: 20),
          _buildCommitmentsCard(),
        ],
      ),
    );
  }

  Widget _buildStatusBanner() {
    final isConfigured = _config?.isConfigured ?? false;

    if (isConfigured) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Operational Availability Active',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Timezone: ${_config?.timezone ?? "Asia/Kolkata"} • Conflict prevention enabled across quotations & bookings.',
                    style: const TextStyle(color: Colors.white70, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 22),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Availability Setup Required',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'You have not configured your operating schedule. Eventalogy requires explicit availability to prevent double bookings and confirm quotations.',
            style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
          ),
          const SizedBox(height: 10),
          ElevatedButton.icon(
            key: const Key('quick_setup_btn'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: _applyQuickSetup,
            icon: const Icon(Icons.bolt, color: Colors.black, size: 16),
            label: const Text(
              'Apply Standard Schedule (Mon-Sat, 9AM-9PM)',
              style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOperatingDaysCard() {
    final dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
              Icon(Icons.view_week_rounded, color: AppColors.primary, size: 18),
              SizedBox(width: 8),
              Text(
                'Weekly Operating Days *',
                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Select the days of the week your business accepts bookings:',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (index) {
              final isSelected = _selectedDays.contains(index);
              return GestureDetector(
                key: Key('day_chip_$index'),
                onTap: () {
                  setState(() {
                    if (isSelected) {
                      _selectedDays.remove(index);
                    } else {
                      _selectedDays.add(index);
                      _selectedDays.sort();
                    }
                  });
                },
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : AppColors.surfaceLighter,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.glassBorder,
                    ),
                  ),
                  child: Text(
                    dayNames[index],
                    style: TextStyle(
                      color: isSelected ? Colors.black : Colors.white70,
                      fontSize: 11,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildOperatingHoursCard() {
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
              Icon(Icons.access_time_rounded, color: AppColors.primary, size: 18),
              SizedBox(width: 8),
              Text(
                'Operating Hours & Turnaround Buffers',
                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'Opening Time',
                  value: _openTime,
                  items: _timeOptions,
                  onChanged: (val) => setState(() => _openTime = val!),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDropdown(
                  label: 'Closing Time',
                  value: _closeTime,
                  items: _timeOptions,
                  onChanged: (val) => setState(() => _closeTime = val!),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'Setup Buffer',
                  value: '$_setupBufferMinutes mins',
                  items: _bufferOptions.map((b) => '$b mins').toList(),
                  onChanged: (val) {
                    final mins = int.tryParse(val?.replaceAll(' mins', '') ?? '60') ?? 60;
                    setState(() => _setupBufferMinutes = mins);
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDropdown(
                  label: 'Teardown Buffer',
                  value: '$_teardownBufferMinutes mins',
                  items: _bufferOptions.map((b) => '$b mins').toList(),
                  onChanged: (val) {
                    final mins = int.tryParse(val?.replaceAll(' mins', '') ?? '60') ?? 60;
                    setState(() => _teardownBufferMinutes = mins);
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCapacityCard() {
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
              Icon(Icons.inventory_2_rounded, color: AppColors.primary, size: 18),
              SizedBox(width: 8),
              Text(
                'Capacity & Concurrency Limits *',
                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Define how many simultaneous events or units your vendor profile can service concurrently:',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: const Key('capacity_type_dropdown'),
            initialValue: _capacityType,
            dropdownColor: AppColors.surfaceLighter,
            isExpanded: true,
            decoration: InputDecoration(
              labelText: 'Capacity Model',
              labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
              filled: true,
              fillColor: AppColors.surfaceLighter,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
            items: _capacityLabels.entries.map((entry) {
              return DropdownMenuItem<String>(
                value: entry.key,
                child: Text(
                  entry.value,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _capacityType = val);
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Default Capacity Limit',
                      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Maximum concurrent bookings before date is marked fully booked',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 10),
                    ),
                  ],
                ),
              ),
              Row(
                children: [
                  IconButton(
                    key: const Key('capacity_decrement_btn'),
                    icon: const Icon(Icons.remove_circle_outline, color: AppColors.primary),
                    onPressed: _defaultCapacity > 1
                        ? () => setState(() => _defaultCapacity--)
                        : null,
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLighter,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Text(
                      '$_defaultCapacity',
                      key: const Key('capacity_value_text'),
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    key: const Key('capacity_increment_btn'),
                    icon: const Icon(Icons.add_circle_outline, color: AppColors.primary),
                    onPressed: () => setState(() => _defaultCapacity++),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBlackoutCard() {
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Row(
                  children: [
                    Icon(Icons.event_busy_rounded, color: AppColors.error, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Blackout Dates & Vacations',
                        style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                key: const Key('add_blackout_btn'),
                onPressed: _showAddBlackoutDialog,
                icon: const Icon(Icons.add, size: 16, color: AppColors.primary),
                label: const Text('Add Date', style: TextStyle(color: AppColors.primary, fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Dates marked unavailable for quotations and booking requests:',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 8),
          if (_blackoutDates.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'No blackout dates configured.',
                style: TextStyle(color: Colors.white38, fontSize: 11, fontStyle: FontStyle.italic),
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _blackoutDates.map((b) {
                return Chip(
                  key: Key('blackout_chip_${b.date}'),
                  backgroundColor: AppColors.error.withValues(alpha: 0.15),
                  side: BorderSide(color: AppColors.error.withValues(alpha: 0.4)),
                  label: Text(
                    b.reason != null ? '${b.date} (${b.reason})' : b.date,
                    style: const TextStyle(color: Colors.white, fontSize: 11),
                  ),
                  deleteIcon: const Icon(Icons.close, size: 14, color: Colors.white70),
                  onDeleted: () => _removeBlackout(b.date),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildCommitmentsCard() {
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
              Icon(Icons.event_available_rounded, color: AppColors.primary, size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Upcoming Confirmed Commitments',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Active reservations consuming capacity. Customer PII is protected for privacy:',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
          ),
          const SizedBox(height: 10),
          if (_commitments.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No active commitments on record. You are open for bookings on your configured operating days.',
                style: TextStyle(color: Colors.white38, fontSize: 11, fontStyle: FontStyle.italic),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _commitments.length,
              separatorBuilder: (_, index) => const Divider(color: AppColors.glassBorder, height: 12),
              itemBuilder: (context, index) {
                final c = _commitments[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          c.eventDate,
                          style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.eventTitle,
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'Booking #${c.bookingId.length > 8 ? c.bookingId.substring(0, 8).toUpperCase() : c.bookingId.toUpperCase()} • Qty: ${c.quantity}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          c.status.toUpperCase(),
                          style: const TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          initialValue: items.contains(value) ? value : items.first,
          dropdownColor: AppColors.surfaceLighter,
          isExpanded: true,
          decoration: InputDecoration(
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            filled: true,
            fillColor: AppColors.surfaceLighter,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
          style: const TextStyle(color: Colors.white, fontSize: 12),
          items: items.map((item) {
            return DropdownMenuItem<String>(
              value: item,
              child: Text(item, overflow: TextOverflow.ellipsis),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }
}
