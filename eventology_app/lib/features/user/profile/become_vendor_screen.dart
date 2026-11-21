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
  final _formKey2 = GlobalKey<FormState>();
  final _formKey3 = GlobalKey<FormState>();
  final _formKey4 = GlobalKey<FormState>();
  final _formKey5 = GlobalKey<FormState>();

  // Tier 1: Legal Identity & KYC
  final _businessNameCtrl = TextEditingController();
  final _legalEntityNameCtrl = TextEditingController();
  final _ownerNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _gstinCtrl = TextEditingController();
  final _panCtrl = TextEditingController();
  String _selectedEntityType = 'pvt_ltd';

  // Tier 2: Category & Equipment Manifest
  List<Map<String, dynamic>> _allCategories = [];
  List<Map<String, dynamic>> _allLocations = [];
  final List<String> _selectedCategories = [];
  String? _selectedLocation;
  final _equipmentManifestCtrl = TextEditingController();

  // Tier 3: Bank Settlement & Escrow
  final _bankHolderCtrl = TextEditingController();
  final _bankNameCtrl = TextEditingController();
  final _accountNumberCtrl = TextEditingController();
  final _confirmAccountCtrl = TextEditingController();
  final _ifscCtrl = TextEditingController();
  String _selectedAccountType = 'current';

  // Tier 4: Technical & Site Operations Logistics
  final _powerKvaCtrl = TextEditingController(text: '15');
  final _crewCountCtrl = TextEditingController(text: '6');
  final _setupTimeCtrl = TextEditingController(text: '4');
  final _strikeTimeCtrl = TextEditingController(text: '2');
  final _sparePolicyCtrl = TextEditingController(text: 'Redundant digital console and backup power cables on-site.');

  // Tier 5: Commercial Policies & Escrow Acceptance
  final _basePriceCtrl = TextEditingController(text: '25000');
  final _insuranceCtrl = TextEditingController();
  bool _escrowTermsAccepted = false;
  String _selectedCancellationPolicy = 'standard';

  bool _isLoadingData = true;
  bool _isSubmitting = false;

  final List<String> _stepTitles = [
    'Legal KYC',
    'Equipment',
    'Bank & Escrow',
    'Site Logistics',
    'Commercials',
  ];

  @override
  void initState() {
    super.initState();
    _fetchMasterData();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _businessNameCtrl.dispose();
    _legalEntityNameCtrl.dispose();
    _ownerNameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _gstinCtrl.dispose();
    _panCtrl.dispose();
    _equipmentManifestCtrl.dispose();
    _bankHolderCtrl.dispose();
    _bankNameCtrl.dispose();
    _accountNumberCtrl.dispose();
    _confirmAccountCtrl.dispose();
    _ifscCtrl.dispose();
    _powerKvaCtrl.dispose();
    _crewCountCtrl.dispose();
    _setupTimeCtrl.dispose();
    _strikeTimeCtrl.dispose();
    _sparePolicyCtrl.dispose();
    _basePriceCtrl.dispose();
    _insuranceCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchMasterData() async {
    try {
      final user = authStateNotifier.user;
      if (user != null) {
        final existingVendor = await VendorRepository.getVendorByUserId(user.uid);
        if (existingVendor != null && mounted) {
          context.go('/vendor');
          return;
        }
        _emailCtrl.text = user.email ?? '';
        _ownerNameCtrl.text = user.displayName ?? '';
      }

      final db = FirestoreConfig.instance;

      final catSnap = await db.collection(Collections.categories).get();
      _allCategories = catSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['name'] ?? d.id})
          .toList();

      if (_allCategories.isEmpty) {
        _allCategories = [
          {'id': 'cat_audio', 'name': 'Sound & Audio Production'},
          {'id': 'cat_lighting', 'name': 'Lighting & Visual Effects'},
          {'id': 'cat_stage', 'name': 'Stage, Trussing & Rigging'},
          {'id': 'cat_power', 'name': 'Generators & Silent Power'},
          {'id': 'cat_catering', 'name': 'Catering & Hospitality'},
          {'id': 'cat_decor', 'name': 'Decor, Sets & Fabrication'},
          {'id': 'cat_photo', 'name': 'Photography & Live Broadcast'},
        ];
      }

      final locSnap = await db.collection(Collections.locations).get();
      _allLocations = locSnap.docs
          .map((d) => {'id': d.id, 'name': d.data()['city'] ?? d.id})
          .toList();

      if (_allLocations.isEmpty) {
        _allLocations = [
          {'id': 'loc_mumbai', 'name': 'Mumbai'},
          {'id': 'loc_delhi', 'name': 'Delhi-NCR'},
          {'id': 'loc_bengaluru', 'name': 'Bengaluru'},
          {'id': 'loc_hyderabad', 'name': 'Hyderabad'},
          {'id': 'loc_goa', 'name': 'Goa'},
        ];
      }
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
            content: Text('Please select at least one production category'),
            backgroundColor: AppColors.error,
          ),
        );
        canProceed = false;
      }
      if (_selectedLocation == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please select your base operating city'),
            backgroundColor: AppColors.error,
          ),
        );
        canProceed = false;
      }
      if (canProceed) canProceed = _formKey2.currentState!.validate();
    }
    if (_currentStep == 2) canProceed = _formKey3.currentState!.validate();
    if (_currentStep == 3) canProceed = _formKey4.currentState!.validate();
    if (_currentStep == 4) {
      canProceed = _formKey5.currentState!.validate();
      if (!_escrowTermsAccepted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('You must accept Eventology Milestone Escrow terms to proceed'),
            backgroundColor: AppColors.error,
          ),
        );
        canProceed = false;
      }
    }

    if (canProceed && _currentStep < 4) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else if (canProceed && _currentStep == 4) {
      _submitApplication();
    }
  }

  Future<void> _submitApplication() async {
    setState(() => _isSubmitting = true);
    try {
      final user = authStateNotifier.user;
      if (user == null) throw Exception("You must be logged in to apply as a vendor.");

      final basePriceVal = double.tryParse(_basePriceCtrl.text.trim()) ?? 0.0;
      final baseDayRatePaise = (basePriceVal * 100).toInt();

      final vendor = VendorModel(
        vendorId: '',
        userId: user.uid,
        businessName: _businessNameCtrl.text.trim(),
        ownerName: _ownerNameCtrl.text.trim(),
        legalEntityName: _legalEntityNameCtrl.text.trim().isNotEmpty ? _legalEntityNameCtrl.text.trim() : null,
        tradeName: _businessNameCtrl.text.trim(),
        entityType: _selectedEntityType,
        gstNumber: _gstinCtrl.text.trim().isNotEmpty ? _gstinCtrl.text.trim().toUpperCase() : null,
        panNumber: _panCtrl.text.trim().isNotEmpty ? _panCtrl.text.trim().toUpperCase() : null,
        email: _emailCtrl.text.trim(),
        phone: _phoneCtrl.text.trim(),
        opsEmergencyPhone: _phoneCtrl.text.trim(),
        locationId: _selectedLocation,
        status: 'pending',
        verified: false,
        categoryIds: _selectedCategories,
        createdAt: Timestamp.now(),
        // Tier 2: Bank details
        bankAccountHolder: _bankHolderCtrl.text.trim(),
        bankName: _bankNameCtrl.text.trim(),
        accountNumber: _accountNumberCtrl.text.trim(),
        ifscCode: _ifscCtrl.text.trim().toUpperCase(),
        accountType: _selectedAccountType,
        payoutStatus: 'pending_verification',
        // Tier 3: Manifest
        equipmentManifest: {
          'summary': _equipmentManifestCtrl.text.trim(),
          'categories': _selectedCategories,
        },
        // Tier 4: Logistics
        maxPowerDrawKva: double.tryParse(_powerKvaCtrl.text.trim()) ?? 15.0,
        coreCrewHeadcount: int.tryParse(_crewCountCtrl.text.trim()) ?? 6,
        setupLeadTimeHours: double.tryParse(_setupTimeCtrl.text.trim()) ?? 4.0,
        strikeTimeHours: double.tryParse(_strikeTimeCtrl.text.trim()) ?? 2.0,
        spareEquipmentPolicy: _sparePolicyCtrl.text.trim(),
        // Tier 5: Commercials
        baseDayRatePaise: baseDayRatePaise,
        escrowTermsAccepted: _escrowTermsAccepted,
        insurancePolicyNumber: _insuranceCtrl.text.trim().isNotEmpty ? _insuranceCtrl.text.trim() : null,
        cancellationPolicy: _selectedCancellationPolicy,
      );

      await VendorRepository.createVendor(vendor);
      await authStateNotifier.refreshRoleClaims();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Institutional Application Submitted! Under KYC verification.'),
            backgroundColor: Colors.green,
          ),
        );
        context.go('/vendor');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submission Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
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
          'Step ${_currentStep + 1} of 5: ${_stepTitles[_currentStep]}',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.2,
            color: Colors.white,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(40),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
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
                          : Colors.white.withValues(alpha: 0.1),
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
          // Step 1: Legal Identity & KYC
          _buildFormStep(
            title: 'Legal Entity & KYC',
            subtitle: 'Provide registered business details for tax compliance & contract execution.',
            content: Form(
              key: _formKey1,
              child: Column(
                children: [
                  _buildGlassTextField(
                    controller: _businessNameCtrl,
                    label: 'Trade / Brand Name *',
                    hint: 'e.g. Apex Audio Visual Productions',
                    validator: (v) => v == null || v.trim().isEmpty ? 'Trade name is required' : null,
                  ),
                  const SizedBox(height: 16),
                  _buildGlassTextField(
                    controller: _legalEntityNameCtrl,
                    label: 'Legal Entity Name (MCA/Registrar)',
                    hint: 'e.g. Apex Live Events Private Limited',
                  ),
                  const SizedBox(height: 16),
                  _buildGlassTextField(
                    controller: _ownerNameCtrl,
                    label: 'Authorized Signatory Name *',
                    hint: 'Full name of Director / Partner / Proprietor',
                    validator: (v) => v == null || v.trim().isEmpty ? 'Signatory name is required' : null,
                  ),
                  const SizedBox(height: 16),
                  _buildDropdownField(
                    label: 'Entity Structure',
                    value: _selectedEntityType,
                    items: const [
                      DropdownMenuItem(value: 'sole_proprietorship', child: Text('Sole Proprietorship')),
                      DropdownMenuItem(value: 'partnership', child: Text('Partnership Firm')),
                      DropdownMenuItem(value: 'llp', child: Text('Limited Liability Partnership (LLP)')),
                      DropdownMenuItem(value: 'pvt_ltd', child: Text('Private Limited Company')),
                      DropdownMenuItem(value: 'public_ltd', child: Text('Public Limited Company')),
                    ],
                    onChanged: (val) => setState(() => _selectedEntityType = val!),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _gstinCtrl,
                          label: 'GSTIN (15 Digits)',
                          hint: '27AAAAA0000A1Z5',
                          textCapitalization: TextCapitalization.characters,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _panCtrl,
                          label: 'Business PAN *',
                          hint: 'ABCDE1234F',
                          textCapitalization: TextCapitalization.characters,
                          validator: (v) => v == null || v.trim().length != 10 ? '10-char PAN required' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _phoneCtrl,
                          label: 'Emergency Operations Phone *',
                          hint: '+91 98765 43210',
                          keyboardType: TextInputType.phone,
                          validator: (v) => v == null || v.trim().isEmpty ? 'Required for show dispatch' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _emailCtrl,
                          label: 'Official Billing Email *',
                          hint: 'accounts@vendor.com',
                          keyboardType: TextInputType.emailAddress,
                          validator: (v) => v == null || !v.contains('@') ? 'Valid email required' : null,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Step 2: Categories & Technical Equipment Manifest
          _buildFormStep(
            title: 'Equipment & Specialization',
            subtitle: 'Select categories and document your production gear manifests.',
            content: Form(
              key: _formKey2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Select Production Categories *', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _allCategories.map((cat) {
                      final isSelected = _selectedCategories.contains(cat['id']);
                      return FilterChip(
                        selected: isSelected,
                        label: Text(cat['name'], style: TextStyle(color: isSelected ? Colors.black : Colors.white)),
                        selectedColor: AppColors.primary,
                        backgroundColor: AppColors.surface,
                        side: BorderSide(color: isSelected ? AppColors.primary : AppColors.glassBorder),
                        onSelected: (val) {
                          setState(() {
                            val ? _selectedCategories.add(cat['id']) : _selectedCategories.remove(cat['id']);
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  _buildDropdownField(
                    label: 'Base Operational City *',
                    value: _selectedLocation,
                    hint: 'Select City Hub',
                    items: _allLocations.map((l) => DropdownMenuItem<String>(value: l['id'], child: Text(l['name']))).toList(),
                    onChanged: (val) => setState(() => _selectedLocation = val),
                  ),
                  const SizedBox(height: 16),
                  _buildGlassTextField(
                    controller: _equipmentManifestCtrl,
                    label: 'Gear Inventory Manifest & Certifications *',
                    hint: 'e.g. 12x JBL VTX V20, Yamaha CL5 Console, 40x24ft HD box truss, 125kVA DG Set, FSSAI: 11521000000000',
                    maxLines: 4,
                    validator: (v) => v == null || v.trim().isEmpty ? 'Gear manifest details required' : null,
                  ),
                ],
              ),
            ),
          ),

          // Step 3: Bank Settlement & Escrow Account
          _buildFormStep(
            title: 'Bank & Escrow Payouts',
            subtitle: 'Account details must match legal entity or PAN for automated milestone releases.',
            content: Form(
              key: _formKey3,
              child: Column(
                children: [
                  _buildGlassTextField(
                    controller: _bankHolderCtrl,
                    label: 'Beneficiary Account Holder Name *',
                    hint: 'Exact name as per Bank / PAN record',
                    validator: (v) => v == null || v.trim().isEmpty ? 'Account holder name is required' : null,
                  ),
                  const SizedBox(height: 16),
                  _buildGlassTextField(
                    controller: _bankNameCtrl,
                    label: 'Bank Name *',
                    hint: 'e.g. HDFC Bank, ICICI Bank, State Bank of India',
                    validator: (v) => v == null || v.trim().isEmpty ? 'Bank name is required' : null,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _accountNumberCtrl,
                          label: 'Account Number *',
                          hint: '9-18 digits',
                          keyboardType: TextInputType.number,
                          validator: (v) => v == null || v.trim().length < 8 ? 'Valid account number required' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _confirmAccountCtrl,
                          label: 'Confirm Account *',
                          hint: 'Re-enter account number',
                          keyboardType: TextInputType.number,
                          validator: (v) => v != _accountNumberCtrl.text ? 'Account numbers do not match' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _ifscCtrl,
                          label: 'Bank IFSC Code *',
                          hint: '11 characters (e.g. HDFC0001234)',
                          textCapitalization: TextCapitalization.characters,
                          validator: (v) => v == null || v.trim().length != 11 ? 'Valid 11-char IFSC required' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildDropdownField(
                          label: 'Account Type',
                          value: _selectedAccountType,
                          items: const [
                            DropdownMenuItem(value: 'current', child: Text('Current Account')),
                            DropdownMenuItem(value: 'savings', child: Text('Savings Account')),
                          ],
                          onChanged: (val) => setState(() => _selectedAccountType = val!),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Step 4: Technical & Site Operations Logistics
          _buildFormStep(
            title: 'Technical Site Logistics',
            subtitle: 'Operational parameters for CAD floorplan load planning and loading dock dispatch.',
            content: Form(
              key: _formKey4,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _powerKvaCtrl,
                          label: 'Max Connected Load (kVA) *',
                          hint: 'e.g. 15',
                          keyboardType: TextInputType.number,
                          validator: (v) => v == null || double.tryParse(v) == null ? 'Valid kVA required' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _crewCountCtrl,
                          label: 'Core Crew Headcount *',
                          hint: 'e.g. 6',
                          keyboardType: TextInputType.number,
                          validator: (v) => v == null || int.tryParse(v) == null ? 'Headcount required' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _setupTimeCtrl,
                          label: 'Load-in & Setup (Hours) *',
                          hint: 'e.g. 4.0',
                          keyboardType: TextInputType.number,
                          validator: (v) => v == null || double.tryParse(v) == null ? 'Required' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildGlassTextField(
                          controller: _strikeTimeCtrl,
                          label: 'Strike & Teardown (Hours) *',
                          hint: 'e.g. 2.0',
                          keyboardType: TextInputType.number,
                          validator: (v) => v == null || double.tryParse(v) == null ? 'Required' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildGlassTextField(
                    controller: _sparePolicyCtrl,
                    label: 'Redundancy & Hot-Standby Spare Policy *',
                    hint: 'Spare amplifier channels, backup digital mixer, secondary cables...',
                    maxLines: 3,
                    validator: (v) => v == null || v.trim().isEmpty ? 'Redundancy policy required' : null,
                  ),
                ],
              ),
            ),
          ),

          // Step 5: Commercial Policies & Escrow Acceptance
          _buildFormStep(
            title: 'Commercial Terms & Escrow',
            subtitle: 'Establish your day rate floor and milestone escrow settlement framework.',
            content: Form(
              key: _formKey5,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildGlassTextField(
                    controller: _basePriceCtrl,
                    label: 'Minimum Base Day-Rate (₹ INR) *',
                    hint: 'e.g. 25000',
                    keyboardType: TextInputType.number,
                    validator: (v) => v == null || double.tryParse(v) == null ? 'Valid amount required' : null,
                  ),
                  const SizedBox(height: 16),
                  _buildGlassTextField(
                    controller: _insuranceCtrl,
                    label: 'Commercial Liability / Transit Insurance Policy No.',
                    hint: 'e.g. POL-BAJAJ-778899 (Optional but recommended)',
                  ),
                  const SizedBox(height: 16),
                  _buildDropdownField(
                    label: 'Cancellation & Refund Framework',
                    value: _selectedCancellationPolicy,
                    items: const [
                      DropdownMenuItem(value: 'standard', child: Text('Standard (>14 days 50% refund, <72h 0%)')),
                      DropdownMenuItem(value: 'moderate', child: Text('Moderate (>7 days 50% refund, <48h 0%)')),
                      DropdownMenuItem(value: 'strict', child: Text('Strict (>30 days 50% refund, <7 days 0%)')),
                    ],
                    onChanged: (val) => setState(() => _selectedCancellationPolicy = val!),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _escrowTermsAccepted ? Colors.green : AppColors.glassBorder),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Checkbox(
                          value: _escrowTermsAccepted,
                          activeColor: AppColors.primary,
                          checkColor: Colors.black,
                          onChanged: (v) => setState(() => _escrowTermsAccepted = v ?? false),
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'I accept the Eventology 25% - 50% - 25% Milestone Escrow Agreement. Advance (25%) on contract, Mid-milestone (50%) on loading dock soundcheck signoff, Final release (25%) upon strike completion.',
                            style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
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
                    minimumSize: const Size(double.infinity, 54),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    _currentStep == 4 ? 'SUBMIT INSTITUTIONAL APPLICATION' : 'CONTINUE TO ${_stepTitles[_currentStep + 1].toUpperCase()}',
                    style: const TextStyle(
                      fontSize: 14,
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          content,
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
    TextCapitalization textCapitalization = TextCapitalization.none,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          validator: validator,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.03),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.glassBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.glassBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.primary),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField<T>({
    required String label,
    required T? value,
    required List<DropdownMenuItem<T>> items,
    required void Function(T?) onChanged,
    String? hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.03),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              dropdownColor: AppColors.surface,
              isExpanded: true,
              value: value,
              hint: hint != null ? Text(hint, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)) : null,
              icon: const Icon(Icons.keyboard_arrow_down, color: AppColors.textSecondary),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              items: items,
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}
