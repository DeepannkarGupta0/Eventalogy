import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/responsive_web_container.dart';
import '../../../models/event_type_model.dart';
import '../../../models/location_model.dart';
import '../../../services/firestore/catalog_repository.dart';
import '../../../services/firestore/location_repository.dart';

class UserPlannerView extends StatefulWidget {
  const UserPlannerView({super.key});

  @override
  State<UserPlannerView> createState() => _UserPlannerViewState();
}

class _UserPlannerViewState extends State<UserPlannerView> {
  int _currentStep = 0;

  // Step 1: Event Type
  String _selectedEventType = 'Wedding';

  // Step 2: City & Venue Style
  String _selectedCity = 'Raipur';
  String _selectedVenueStyle = 'Heritage Palace / Ballroom';

  // Step 3: Date & Guest Scale
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 45));
  double _guestCount = 350;

  // Step 4: Budget Scope
  String _selectedBudgetLabel = '₹25 Lakhs';
  final TextEditingController _customBudgetCtrl = TextEditingController();

  // Step 5: Services & Vision
  final Map<String, bool> _selectedServices = {
    'Venue & Banquet': true,
    'Concert Audio & PA': true,
    'Intelligent Lighting & Truss': true,
    'Mandap / Stage Decor': true,
    'Royal Catering': true,
    'Photography & Film': true,
    'Power Generators & Backup': false,
    'Guest Hospitality & Logistics': false,
  };
  final TextEditingController _visionNotesCtrl = TextEditingController();

  static const Color _emerald = Color(0xFF10B981);

  final List<String> _stepTitles = const [
    'Event Type',
    'City & Style',
    'Date & Scale',
    'Budget Scope',
    'Services & Vision',
  ];

  final List<String> _fallbackEventTypes = const [
    'Wedding',
    'Corporate Summit',
    'Concert & Festival',
    'Reception Gala',
    'Exhibition & Trade Fair',
    'Birthday Celebration',
  ];

  final List<String> _fallbackCities = const [
    'Raipur',
    'Mumbai',
    'Delhi-NCR',
    'Bengaluru',
    'Jaipur',
    'Goa',
  ];

  final List<String> _venueStyles = const [
    'Heritage Palace / Ballroom',
    'Open Luxury Lawn',
    'Convention Arena / Expo Hall',
    'Beachfront / Destination Resort',
  ];

  final List<String> _budgetPresets = const [
    '₹10 Lakhs',
    '₹25 Lakhs',
    '₹50 Lakhs',
    '₹1 Crore+',
  ];

  @override
  void dispose() {
    _customBudgetCtrl.dispose();
    _visionNotesCtrl.dispose();
    super.dispose();
  }

  String get _effectiveBudget =>
      _customBudgetCtrl.text.trim().isNotEmpty
          ? _customBudgetCtrl.text.trim()
          : _selectedBudgetLabel;

  void _launchAgentsWithPlan() {
    final chosenServices = _selectedServices.entries
        .where((e) => e.value)
        .map((e) => e.key)
        .toList();
    final formattedDate = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final guests = _guestCount.round();
    final notes = _visionNotesCtrl.text.trim();

    final promptBuffer = StringBuffer()
      ..writeln('Create a full production plan from my 5-step brief:')
      ..writeln('1. Event Type: $_selectedEventType')
      ..writeln('2. City & Setting: $_selectedCity ($_selectedVenueStyle)')
      ..writeln('3. Date & Guest Count: $formattedDate for $guests guests')
      ..writeln('4. Target Budget: $_effectiveBudget')
      ..writeln('5. Required Services: ${chosenServices.isEmpty ? "Full Production" : chosenServices.join(", ")}');
    if (notes.isNotEmpty) {
      promptBuffer.writeln('Additional Vision & Notes: $notes');
    }

    final initialRequirements = <String, dynamic>{
      'eventType': _selectedEventType,
      'location': _selectedCity,
      'dateStr': formattedDate,
      'guestCount': guests,
      'budgetStr': _effectiveBudget,
      'preferences': [
        _selectedVenueStyle,
        ...chosenServices,
        if (notes.isNotEmpty) notes,
      ],
    };

    context.push('/ai-chat', extra: {
      'initialMessage': promptBuffer.toString().trim(),
      'initialRequirements': initialRequirements,
      'autoOpenWorkspace': true,
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 960;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          0,
          isDesktop ? 28 : 54,
          0,
          isDesktop ? 48 : 120,
        ),
        child: ResponsiveWebContainer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(context, isDesktop),
              const SizedBox(height: 24),
              _buildStepProgressBar(),
              const SizedBox(height: 20),
              _buildStepCard(),
              const SizedBox(height: 28),
              _buildCatalogTemplatesSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDesktop) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF151822), Color(0xFF0D0F16)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '5-STEP AI PRODUCTION PLANNER',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Answer 5 Quick Questions → Activate All 14 Agents',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: isDesktop ? 26 : 20,
                    fontWeight: FontWeight.w900,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Once submitted, our Orchestrator runs Planning, Parallel Venue/Vendor/Service search, Availability, Budget, NBC Physics, and Logistics sequentially — and opens results alongside live Chat.',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          if (isDesktop) ...[
            const SizedBox(width: 16),
            OutlinedButton.icon(
              onPressed: () => context.push('/ai-chat', extra: {'autoOpenWorkspace': true}),
              icon: const Icon(Icons.forum_outlined, size: 16, color: AppColors.primary),
              label: const Text(
                'Open Chat Workspace',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppColors.primary.withValues(alpha: 0.45)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStepProgressBar() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(_stepTitles.length, (i) {
        final isActive = i == _currentStep;
        final isCompleted = i < _currentStep;
        return GestureDetector(
          onTap: () => setState(() => _currentStep = i),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isActive
                  ? AppColors.primary.withValues(alpha: 0.16)
                  : isCompleted
                      ? _emerald.withValues(alpha: 0.14)
                      : AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isActive
                    ? AppColors.primary
                    : isCompleted
                        ? _emerald.withValues(alpha: 0.5)
                        : AppColors.glassBorder,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isCompleted ? Icons.check_circle : Icons.circle_outlined,
                  size: 14,
                  color: isActive
                      ? AppColors.primary
                      : isCompleted
                          ? _emerald
                          : AppColors.textSecondary,
                ),
                const SizedBox(width: 6),
                Text(
                  '${i + 1}. ${_stepTitles[i]}',
                  style: TextStyle(
                    color: isActive || isCompleted ? Colors.white : AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }

  Widget _buildStepCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'STEP ${_currentStep + 1} OF 5 · ${_stepTitles[_currentStep].toUpperCase()}',
            style: const TextStyle(
              color: AppColors.primary,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          _buildCurrentStepBody(),
          const SizedBox(height: 24),
          Row(
            children: [
              if (_currentStep > 0)
                OutlinedButton.icon(
                  onPressed: () => setState(() => _currentStep--),
                  icon: const Icon(Icons.arrow_back_rounded, size: 16),
                  label: const Text('Back'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: AppColors.glassBorder),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                  ),
                ),
              const Spacer(),
              if (_currentStep < 4)
                ElevatedButton.icon(
                  onPressed: () => setState(() => _currentStep++),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 17),
                  label: const Text('Next Question', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                  ),
                )
              else
                ElevatedButton.icon(
                  onPressed: _launchAgentsWithPlan,
                  icon: const Icon(Icons.hub_rounded, size: 18),
                  label: const Text(
                    'Activate 14 AI Agents & Build Plan',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentStepBody() {
    switch (_currentStep) {
      case 0:
        return StreamBuilder<List<EventTypeModel>>(
          stream: CatalogRepository.streamActiveEventTypes(),
          builder: (context, snapshot) {
            final dbNames = (snapshot.data ?? []).map((e) => e.name).toList();
            final options = dbNames.isNotEmpty ? dbNames : _fallbackEventTypes;
            if (!options.contains(_selectedEventType) && options.isNotEmpty) {
              _selectedEventType = options.first;
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'What type of event are we architecting?',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: options.map((typeName) {
                    final selected = typeName == _selectedEventType;
                    return ChoiceChip(
                      label: Text(typeName),
                      selected: selected,
                      onSelected: (_) => setState(() => _selectedEventType = typeName),
                      selectedColor: AppColors.primary,
                      backgroundColor: AppColors.surfaceLighter,
                      labelStyle: TextStyle(
                        color: selected ? Colors.black : Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  }).toList(),
                ),
              ],
            );
          },
        );

      case 1:
        return StreamBuilder<List<LocationModel>>(
          stream: LocationRepository.streamLocations(),
          builder: (context, snapshot) {
            final cities = (snapshot.data ?? [])
                .map((l) => l.city)
                .where((c) => c.trim().isNotEmpty)
                .toSet()
                .toList();
            final options = cities.isNotEmpty ? cities : _fallbackCities;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Where will it take place, and what venue setting do you prefer?',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: options.map((city) {
                    final selected = city == _selectedCity;
                    return ChoiceChip(
                      label: Text(city),
                      selected: selected,
                      onSelected: (_) => setState(() => _selectedCity = city),
                      selectedColor: AppColors.primary,
                      backgroundColor: AppColors.surfaceLighter,
                      labelStyle: TextStyle(
                        color: selected ? Colors.black : Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Preferred Venue Style',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: _venueStyles.map((style) {
                    final selected = style == _selectedVenueStyle;
                    return ChoiceChip(
                      label: Text(style),
                      selected: selected,
                      onSelected: (_) => setState(() => _selectedVenueStyle = style),
                      selectedColor: AppColors.accentBlue,
                      backgroundColor: AppColors.surfaceLighter,
                      labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                    );
                  }).toList(),
                ),
              ],
            );
          },
        );

      case 2:
        final nbcMinAreaSqm = (_guestCount * 1.5).round();
        final nbcExitUnits = (_guestCount / 50).ceil();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Select your event date and expected guest count',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (picked != null) setState(() => _selectedDate = picked);
                  },
                  icon: const Icon(Icons.calendar_month_rounded, color: AppColors.primary, size: 18),
                  label: Text(
                    DateFormat('EEE, d MMM yyyy').format(_selectedDate),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.5)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
                const SizedBox(width: 16),
                Text(
                  '${_guestCount.round()} Guests',
                  style: const TextStyle(color: AppColors.primary, fontSize: 22, fontWeight: FontWeight.w900),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Slider(
              value: _guestCount,
              min: 50,
              max: 3000,
              divisions: 59,
              activeColor: AppColors.primary,
              onChanged: (v) => setState(() => _guestCount = v),
            ),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _emerald.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _emerald.withValues(alpha: 0.35)),
              ),
              child: Text(
                'NBC 2016 Pre-Check: ~$nbcMinAreaSqm m² hall floor area · ≥ ${(nbcExitUnits * 0.5).toStringAsFixed(1)}m aggregate fire exit width',
                style: const TextStyle(color: _emerald, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        );

      case 3:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'What is your comfortable production investment budget?',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _budgetPresets.map((preset) {
                final selected = _customBudgetCtrl.text.trim().isEmpty && preset == _selectedBudgetLabel;
                return ChoiceChip(
                  label: Text(preset),
                  selected: selected,
                  onSelected: (_) {
                    setState(() {
                      _selectedBudgetLabel = preset;
                      _customBudgetCtrl.clear();
                    });
                  },
                  selectedColor: AppColors.primary,
                  backgroundColor: AppColors.surfaceLighter,
                  labelStyle: TextStyle(
                    color: selected ? Colors.black : Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _customBudgetCtrl,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                labelText: 'Or enter a custom budget (e.g. ₹35 Lakhs)',
                labelStyle: const TextStyle(color: AppColors.textSecondary),
                filled: true,
                fillColor: AppColors.surfaceLighter,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        );

      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Which production services & special touches do you want included?',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _selectedServices.keys.map((srv) {
                final active = _selectedServices[srv] ?? false;
                return FilterChip(
                  label: Text(srv),
                  selected: active,
                  onSelected: (v) => setState(() => _selectedServices[srv] = v),
                  selectedColor: AppColors.primary,
                  backgroundColor: AppColors.surfaceLighter,
                  checkmarkColor: Colors.black,
                  labelStyle: TextStyle(
                    color: active ? Colors.black : Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _visionNotesCtrl,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Theme / Musical Act / Cultural Requirements (Optional)',
                labelStyle: const TextStyle(color: AppColors.textSecondary),
                filled: true,
                fillColor: AppColors.surfaceLighter,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        );
    }
  }

  Widget _buildCatalogTemplatesSection() {
    return StreamBuilder<List<EventTypeModel>>(
      stream: CatalogRepository.streamActiveEventTypes(),
      builder: (context, snapshot) {
        final eventTypes = snapshot.data ?? [];
        if (eventTypes.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'CURATED CATALOG TEMPLATES',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.4,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: eventTypes.map((event) {
                return InkWell(
                  onTap: () => context.push('/planner/details/${event.eventTypeId}'),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.layers_outlined, color: AppColors.primary, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          '${event.name} Packages',
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textSecondary, size: 12),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }
}
