import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/vendor_model.dart';
import '../../../services/firestore/vendor_repository.dart';
import '../../../services/auth_state_notifier.dart';
import '../../../core/firebase/firestore_config.dart';
import '../../../core/database/collections.dart';

class BecomeVendorScreen extends StatefulWidget {
  const BecomeVendorScreen({super.key});

  @override
  State<BecomeVendorScreen> createState() => _BecomeVendorScreenState();
}

class _BecomeVendorScreenState extends State<BecomeVendorScreen> {
  final PageController _pageController = PageController();
  int _currentStep = 0;

  final _formKey1 = GlobalKey<FormState>();
  final _formKey3 = GlobalKey<FormState>();
  final _formKey4 = GlobalKey<FormState>();

  final _businessNameCtrl = TextEditingController();
  final _ownerNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();

  List<Map<String, dynamic>> _allCategories = [];
  List<Map<String, dynamic>> _allLocations = [];
  List<String> _selectedCategories = [];
  String? _selectedLocation;

  bool _isLoadingData = true;
  bool _isSubmitting = false;

  final List<String> _stepTitles = [
    'Basics',
    'Categories',
    'Contact',
    'Profile',
  ];

  @override
  void initState() {
    super.initState();
    _fetchMasterData();
  }

  Future<void> _fetchMasterData() async {
    try {
      final db = FirestoreConfig.instance;

      final catSnap = await db.collection(Collections.categories).get();
      _allCategories = catSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['name']})
          .toList();

      final locSnap = await db.collection(Collections.locations).get();
      _allLocations = locSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['city'] ?? d.id})
          .toList();
    } catch (e) {
      debugPrint("Error fetching master data: $e");
    } finally {
      if (mounted) setState(() => _isLoadingData = false);
    }
  }

  void _nextStep() {
    bool canProceed = true;
    if (_currentStep == 0) canProceed = _formKey1.currentState!.validate();
    if (_currentStep == 1) {
      if (_selectedCategories.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select at least one category'),
            backgroundColor: AppColors.error,
          ),
        );
        canProceed = false;
      }
    }
    if (_currentStep == 2)
      canProceed =
          _formKey3.currentState!.validate() && _selectedLocation != null;
    if (_currentStep == 3) canProceed = _formKey4.currentState!.validate();

    if (canProceed && _currentStep < 3) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else if (canProceed && _currentStep == 3) {
      _submitApplication();
    }
  }

  Future<void> _submitApplication() async {
    setState(() => _isSubmitting = true);
    try {
      final user = authStateNotifier.user;
      if (user == null) throw Exception("You must be logged in.");

      final vendor = VendorModel(
        vendorId: '',
        userId: user.uid,
        businessName: _businessNameCtrl.text.trim(),
        ownerName: _ownerNameCtrl.text.trim(),
        description: _descriptionCtrl.text.trim().isEmpty
            ? null
            : _descriptionCtrl.text.trim(),
        email: _emailCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        locationId: _selectedLocation,
        status: 'pending',
        verified: false,
        categoryIds: _selectedCategories,
        createdAt: Timestamp.now(),
      );

      await VendorRepository.createVendor(vendor);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Application Submitted!'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  IconData _getIconForCategory(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('venue')) return Icons.business;
    if (lower.contains('cater')) return Icons.restaurant;
    if (lower.contains('photo') || lower.contains('video'))
      return Icons.camera_alt;
    if (lower.contains('decor')) return Icons.celebration;
    if (lower.contains('music') || lower.contains('dj'))
      return Icons.music_note;
    if (lower.contains('makeup') || lower.contains('salon')) return Icons.face;
    return Icons.star;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingData) {
      return const Scaffold(
        backgroundColor: Color(0xFF0D0D0F),
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

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
              context.pop();
            }
          },
        ),
        title: Text(
          'Step ${_currentStep + 1} of 4',
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
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        onPageChanged: (idx) => setState(() => _currentStep = idx),
        children: [
          _buildFormStep(
            title: 'Welcome to Eventology',
            subtitle: 'Let\'s start with the basics of your business.',
            content: Form(
              key: _formKey1,
              child: Column(
                children: [
                  _buildGlassTextField(
                    controller: _businessNameCtrl,
                    label: 'Business Name',
                    hint: 'E.g. Grand Horizon Venues',
                  ),
                  const SizedBox(height: 24),
                  _buildGlassTextField(
                    controller: _ownerNameCtrl,
                    label: 'Owner Full Name',
                    hint: 'E.g. Mukesh Ambani',
                  ),
                ],
              ),
            ),
          ),
          _buildFormStep(
            title: 'Your Expertise',
            subtitle: 'What services do you provide? Select all that apply.',
            content: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.1,
              ),
              itemCount: _allCategories.length,
              itemBuilder: (context, index) {
                final cat = _allCategories[index];
                final isSelected = _selectedCategories.contains(cat['id']);
                return GestureDetector(
                  onTap: () {
                    setState(() {
                      isSelected
                          ? _selectedCategories.remove(cat['id'])
                          : _selectedCategories.add(cat['id']);
                    });
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.primary.withOpacity(0.1)
                          : AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : AppColors.glassBorder,
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _getIconForCategory(cat['name']),
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.textSecondary,
                          size: 40,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          cat['name'],
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : AppColors.textSecondary,
                            fontWeight: isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                            fontSize: 16,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          _buildFormStep(
            title: 'Contact Details',
            subtitle: 'How will clients and our team reach you?',
            content: Form(
              key: _formKey3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildGlassTextField(
                    controller: _emailCtrl,
                    label: 'Business Email',
                    hint: 'contact@business.com',
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 24),
                  _buildGlassTextField(
                    controller: _phoneCtrl,
                    label: 'Phone Number',
                    hint: '+91 99999 99999',
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Base Location',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.03),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        dropdownColor: AppColors.surface,
                        isExpanded: true,
                        value: _selectedLocation,
                        hint: const Text(
                          'Select City',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                        icon: const Icon(
                          Icons.keyboard_arrow_down,
                          color: AppColors.textSecondary,
                        ),
                        style: const TextStyle(color: Colors.white),
                        items: _allLocations
                            .map(
                              (l) => DropdownMenuItem<String>(
                                value: l['id'],
                                child: Text(l['name']),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _selectedLocation = v),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _buildFormStep(
            title: 'The Narrative',
            subtitle: 'Describe your business in a way that attracts premium clients.',
            content: Form(
              key: _formKey4,
              child: _buildGlassTextField(
                controller: _descriptionCtrl,
                label: 'Business Description',
                hint: 'We provide luxury event services...',
                maxLines: 5,
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 24),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        child: SafeArea(
          child: _isSubmitting
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : ElevatedButton(
                  onPressed: _nextStep,
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
                    _currentStep == 3 ? 'Submit Application' : 'NEXT STEP',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildFormStep({
    required String title,
    required String subtitle,
    required Widget content,
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
              padding: const EdgeInsets.only(bottom: 40),
              child: content,
            ),
          ),
        ],
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
          child: TextFormField(
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
            validator: (v) => v!.isEmpty ? 'Required' : null,
          ),
        ),
      ],
    );
  }
}
