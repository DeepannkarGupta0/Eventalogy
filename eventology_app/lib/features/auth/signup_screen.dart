import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

import '../../core/theme/app_colors.dart';
import '../../services/firebase_auth_service.dart';
import '../../services/firestore/vendor_repository.dart';
import '../../models/vendor_model.dart';
import '../../core/firebase/firestore_config.dart';
import '../../core/database/collections.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // Vendor specific controllers
  final _businessNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _gstController = TextEditingController();

  bool _isVendor = false;
  bool _isLoading = false;
  bool _categoriesLoading = true;

  List<Map<String, dynamic>> _categories = [];
  List<String> _selectedCategories = [];

  @override
  void initState() {
    super.initState();
    _fetchCategories();
  }

  Future<void> _fetchCategories() async {
    try {
      final snap = await FirestoreConfig.instance
          .collection(Collections.categories)
          .get();
      if (mounted) {
        setState(() {
          _categories = snap.docs
              .map((d) => {'id': d.id, 'name': d.data()['name']})
              .toList();
        });
      }
    } catch (e) {
      debugPrint('Error fetching categories: $e');
      // Fallback categories if Firestore fails (e.g., due to auth rules before login)
      if (mounted) {
        setState(() {
          _categories = [
            {'id': 'cat_catering', 'name': 'Elite Catering'},
            {'id': 'cat_photography', 'name': 'Photography'},
            {'id': 'cat_decoration', 'name': 'Luxury Decoration'},
            {'id': 'cat_venue', 'name': 'Venue & Accommodation'},
          ];
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _categoriesLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _businessNameController.dispose();
    _phoneController.dispose();
    _gstController.dispose();
    super.dispose();
  }

  void _handleSignup() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      _showError('Please fill in all required fields');
      return;
    }

    if (_isVendor) {
      if (_businessNameController.text.isEmpty ||
          _phoneController.text.isEmpty ||
          _selectedCategories.isEmpty) {
        _showError(
          'Please fill in vendor details and select at least one category',
        );
        return;
      }
    }

    setState(() => _isLoading = true);

    try {
      final user = await FirebaseAuthService.signUp(
        email: email,
        password: password,
        name: name,
      );

      if (_isVendor && user != null) {
        // Create vendor profile
        final vendor = VendorModel(
          vendorId: '', // auto-generated
          userId: user.user!.uid,
          businessName: _businessNameController.text.trim(),
          ownerName: name,
          email: email,
          phone: _phoneController.text.trim(),
          status: 'pending',
          verified: false,
          categoryIds: _selectedCategories,
          gstNumber: _gstController.text.trim(),
          createdAt: Timestamp.now(),
        );
        await VendorRepository.createVendor(vendor);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Partner Account Created! Pending Admin Approval.'),
              backgroundColor: Colors.green,
            ),
          );
        }
      }

      // The auth state listener will automatically redirect to home/dashboard.
    } catch (e) {
      if (mounted) {
        _showError(e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0F),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.diamond_outlined,
                    size: 48,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Join Eventalogy',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Create an account to continue',
                style: TextStyle(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),

              // User vs Vendor Toggle
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _isVendor = false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: !_isVendor
                                ? AppColors.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            'User',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: !_isVendor ? Colors.black : Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _isVendor = true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: _isVendor
                                ? AppColors.primary
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            'Partner / Vendor',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: _isVendor ? Colors.black : Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),

              // Basic Info
              _buildGlassTextField(
                controller: _nameController,
                label: 'Full Name',
                hint: 'Enter your name',
              ),
              const SizedBox(height: 16),
              _buildGlassTextField(
                controller: _emailController,
                label: 'Email Address',
                hint: 'Enter your email',
              ),
              const SizedBox(height: 16),
              _buildGlassTextField(
                controller: _passwordController,
                label: 'Password',
                hint: 'Create a password',
                isPassword: true,
              ),
              const SizedBox(height: 32),

              // Vendor specific info
              if (_isVendor) ...[
                const Divider(color: AppColors.glassBorder),
                const SizedBox(height: 24),
                const Text(
                  'Partner Details',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                _buildGlassTextField(
                  controller: _businessNameController,
                  label: 'Business Name',
                  hint: 'E.g. Royal Catering',
                ),
                const SizedBox(height: 16),
                _buildGlassTextField(
                  controller: _phoneController,
                  label: 'Phone Number',
                  hint: 'E.g. +91 9876543210',
                ),
                const SizedBox(height: 16),
                _buildGlassTextField(
                  controller: _gstController,
                  label: 'GST Number (Optional)',
                  hint: 'E.g. 22AAAAA0000A1Z5',
                ),
                const SizedBox(height: 24),

                const Text(
                  'Expertise / Category',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                if (_categoriesLoading)
                  const Center(child: CircularProgressIndicator())
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 2.5,
                        ),
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final cat = _categories[index];
                      final isSelected = _selectedCategories.contains(
                        cat['id'],
                      );
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            if (isSelected) {
                              _selectedCategories.remove(cat['id']);
                            } else {
                              _selectedCategories.add(cat['id']);
                            }
                          });
                        },
                        child: Container(
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary.withOpacity(0.15)
                                : Colors.white.withOpacity(0.03),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.glassBorder,
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _getIconForCategory(cat['name']),
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.textSecondary,
                                size: 16,
                              ),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  cat['name'],
                                  style: TextStyle(
                                    color: isSelected
                                        ? Colors.white
                                        : AppColors.textSecondary,
                                    fontWeight: isSelected
                                        ? FontWeight.bold
                                        : FontWeight.normal,
                                    fontSize: 12,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                const SizedBox(height: 32),
              ],

              // Submit
              GestureDetector(
                onTap: _isLoading ? null : _handleSignup,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Center(
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.black,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            _isVendor ? 'Apply as Partner' : 'Create Account',
                            style: const TextStyle(
                              color: AppColors.background,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Google Sign In Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: OutlinedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Google Sign-In coming soon!'),
                      ),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: Colors.white.withOpacity(0.1)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    backgroundColor: Colors.white.withOpacity(0.05),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const Text(
                          'G',
                          style: TextStyle(
                            color: Colors.black,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Continue with Google',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              TextButton(
                onPressed: () => context.go('/'),
                child: const Text(
                  'Already have an account? Sign In',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getIconForCategory(String name) {
    final n = name.toLowerCase();
    if (n.contains('venue')) return Icons.location_city;
    if (n.contains('cater')) return Icons.restaurant;
    if (n.contains('photo') || n.contains('video')) return Icons.camera_alt;
    if (n.contains('decor')) return Icons.celebration;
    if (n.contains('music') || n.contains('dj')) return Icons.music_note;
    if (n.contains('makeup') || n.contains('beauty')) return Icons.brush;
    return Icons.star;
  }

  Widget _buildGlassTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    bool isPassword = false,
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
            obscureText: isPassword,
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
