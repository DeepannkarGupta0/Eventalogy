import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../state/ai_planner_state.dart';
import '../services/ai_planner_service.dart';
import '../../../../core/theme/app_colors.dart';

class AIPlannerFlowScreen extends StatefulWidget {
  const AIPlannerFlowScreen({super.key});

  @override
  State<AIPlannerFlowScreen> createState() => _AIPlannerFlowScreenState();
}

class _AIPlannerFlowScreenState extends State<AIPlannerFlowScreen> {
  final PageController _pageController = PageController();
  int _currentStep = 0;

  final _visionController = TextEditingController();
  final _urlController = TextEditingController();
  final _locationController = TextEditingController();
  final _guestController = TextEditingController();
  final _budgetController = TextEditingController();
  final _otherEventTypeController = TextEditingController();

  bool _isGenerating = false;

  final List<String> _stepTitles = [
    'Details',
    'Vision',
    'Location',
    'Budget',
    'Review',
  ];

  void _nextStep() {
    if (_currentStep == 0) {
      if (_otherEventTypeController.text.trim().isNotEmpty) {
        AIPlannerState().currentRequest.eventType = _otherEventTypeController.text.trim();
      } else if (AIPlannerState().currentRequest.eventType?.isEmpty ?? true) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select or type an event type.')));
        return;
      }
    } else if (_currentStep == 1) {
      if (_visionController.text.trim().length < 10) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please provide a longer vision description (min 10 characters).')));
        return;
      }
      if (_urlController.text.trim().isNotEmpty) {
        final url = _urlController.text.trim().toLowerCase();
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('www.')) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid URL starting with http:// or https://')));
          return;
        }
      }
    } else if (_currentStep == 2) {
      if (_locationController.text.trim().length < 2) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid location.')));
        return;
      }
      final rawGuests = _guestController.text.replaceAll(RegExp(r'[^0-9]'), '');
      final guests = int.tryParse(rawGuests) ?? 0;
      if (guests < 1 || guests > 20000) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a realistic guest count (1 - 20,000).')));
        return;
      }
    } else if (_currentStep == 3) {
      final rawBudget = _budgetController.text.replaceAll(RegExp(r'[^0-9.]'), '');
      final budget = double.tryParse(rawBudget) ?? 0;
      if (budget < 10000 || budget > 500000000) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a realistic total budget (Min ₹10,000).')));
        return;
      }
      final rawGuests = _guestController.text.replaceAll(RegExp(r'[^0-9]'), '');
      final guests = int.tryParse(rawGuests) ?? 1;
      if ((budget / guests) < 500) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Budget is too low for this many guests (Min ₹500/guest).')));
        return;
      }
    }

    if (_currentStep < 4) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _generatePlan() async {
    final request = AIPlannerState().currentRequest;
    if (_otherEventTypeController.text.trim().isNotEmpty) {
      request.eventType = _otherEventTypeController.text.trim();
    }
    
    final prompt = '''
I want to plan an event.
Event Type: ${request.eventType}
Location: ${_locationController.text}
Guest Count: ${_guestController.text}
Budget: ${_budgetController.text}
Vision: ${_visionController.text}
Reference: ${_urlController.text}
''';
    
    context.pushReplacement('/ai-chat', extra: prompt);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0F),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            if (_currentStep > 0) {
              _pageController.previousPage(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
        title: Text(
          'Step ${_currentStep + 1} of 5',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            color: Colors.white,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(60),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Row(
              children: List.generate(_stepTitles.length, (index) {
                final isPassed = index <= _currentStep;
                return Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    height: 4,
                    decoration: BoxDecoration(
                      color: isPassed
                          ? AppColors.primary
                          : Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Ambient Glow Background
          Positioned(
            top: 200,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withOpacity(0.03),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.05),
                    blurRadius: 100,
                    spreadRadius: 50,
                  ),
                ],
              ),
            ),
          ),
          PageView(
            controller: _pageController,
            physics: const NeverScrollableScrollPhysics(),
            onPageChanged: (idx) => setState(() => _currentStep = idx),
            children: [
              // Step 1: Details / Event Type
              _buildFormStep(
                title: 'Event Requirements',
                subtitle: 'What kind of event are we planning today?',
                content: Column(
                  children: [
                    _buildOptionCard(
                      'Wedding',
                      'Luxury matrimonial ceremony',
                      Icons.favorite,
                      () {
                        AIPlannerState().currentRequest.eventType = 'Wedding';
                        _nextStep();
                      },
                    ),
                    const SizedBox(height: 16),
                    _buildOptionCard(
                      'Corporate',
                      'Gala or tech summit',
                      Icons.business,
                      () {
                        AIPlannerState().currentRequest.eventType = 'Corporate';
                        _nextStep();
                      },
                    ),
                    const SizedBox(height: 16),
                    _buildOptionCard(
                      'Birthday',
                      'Premium private party',
                      Icons.cake,
                      () {
                        AIPlannerState().currentRequest.eventType = 'Birthday';
                        _nextStep();
                      },
                    ),
                    const SizedBox(height: 24),
                    _buildGlassTextField(
                      controller: _otherEventTypeController,
                      label: 'Or type your own event type:',
                      hint: 'E.g. Anniversary, Baby Shower',
                      maxLines: 1,
                    ),
                  ],
                ),
                showNextButton: true,
              ),
              // Step 2: Vision
              _buildFormStep(
                title: 'Event Vision',
                subtitle: 'Describe your perfect event...',
                content: Column(
                  children: [
                    _buildGlassTextField(
                      controller: _visionController,
                      label: 'Event Description',
                      hint: 'E.g. A royal sunset wedding with pastel decor...',
                      maxLines: 5,
                    ),
                    const SizedBox(height: 24),
                    _buildGlassTextField(
                      controller: _urlController,
                      label: 'Reference URL (Optional)',
                      hint: 'Pinterest board or Instagram post',
                      maxLines: 1,
                    ),
                  ],
                ),
                showNextButton: true,
              ),
              // Step 3: Location
              _buildFormStep(
                title: 'Event Location',
                subtitle: 'Where is it happening?',
                content: Column(
                  children: [
                    _buildGlassTextField(
                      controller: _locationController,
                      label: 'City or Region',
                      hint: 'E.g. Mumbai, India',
                      maxLines: 1,
                    ),
                    const SizedBox(height: 24),
                    _buildGlassTextField(
                      controller: _guestController,
                      label: 'Estimated Guest Count',
                      hint: 'E.g. 300',
                      maxLines: 1,
                      keyboardType: TextInputType.number,
                    ),
                  ],
                ),
                showNextButton: true,
              ),
              // Step 4: Budget
              _buildFormStep(
                title: 'Budget Allocation',
                subtitle:
                    'Set a total budget for the AI to divide among vendors.',
                content: Column(
                  children: [
                    _buildGlassTextField(
                      controller: _budgetController,
                      label: 'Total Budget (₹)',
                      hint: 'E.g. 1500000',
                      maxLines: 1,
                      keyboardType: TextInputType.number,
                    ),
                  ],
                ),
                showNextButton: true,
              ),
              // Step 5: Review
              _buildFormStep(
                title: 'Ready to Plan?',
                subtitle: 'Our AI Architect will now curate venues, vendors, and pricing specifically for your vision.',
                content: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: AppColors.primary.withOpacity(0.3),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.1),
                            blurRadius: 20,
                            spreadRadius: 0,
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          const Icon(
                            Icons.auto_awesome,
                            size: 64,
                            color: AppColors.primary,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'AI Architect is ready',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Estimated Wait: 15 Seconds',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                showGenerateButton: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFormStep({
    required String title,
    required String subtitle,
    required Widget content,
    bool showNextButton = false,
    bool showGenerateButton = false,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 40),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 120),
              child: content,
            ),
          ),
          if (showNextButton || showGenerateButton)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.glassBorder)),
              ),
              child: SafeArea(
                child: _isGenerating
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.primary,
                        ),
                      )
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (showGenerateButton) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Estimated AI Total',
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  '₹${_budgetController.text.isEmpty ? '1500000' : _budgetController.text}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                          ],
                          ElevatedButton(
                            onPressed: showGenerateButton
                                ? _generatePlan
                                : _nextStep,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.black,
                              minimumSize: const Size(double.infinity, 56),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                            ),
                            child: Text(
                              showGenerateButton
                                  ? 'Confirm & Finalize'
                                  : 'NEXT STEP',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOptionCard(
    String title,
    String desc,
    IconData icon,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.primary),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    desc,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios,
              color: AppColors.textSecondary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGlassTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.03),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: TextField(
            controller: controller,
            maxLines: maxLines,
            keyboardType: keyboardType,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: AppColors.textSecondary),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(20),
            ),
          ),
        ),
      ],
    );
  }
}
