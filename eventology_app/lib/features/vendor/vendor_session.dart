import '../../services/auth_state_notifier.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../models/vendor_model.dart';
import '../../services/firestore/vendor_repository.dart';

class VendorSession extends InheritedWidget {
  final VendorModel vendor;

  const VendorSession({
    super.key,
    required this.vendor,
    required super.child,
  });

  static VendorModel of(BuildContext context) {
    final session = context.dependOnInheritedWidgetOfExactType<VendorSession>();
    if (session == null) {
      throw Exception('VendorSession not found in context');
    }
    return session.vendor;
  }

  @override
  bool updateShouldNotify(VendorSession oldWidget) {
    return oldWidget.vendor != vendor;
  }
}

class MissingVendorProfileView extends StatelessWidget {
  final VoidCallback onRetry;
  final VoidCallback? onCreateProfile;

  const MissingVendorProfileView({
    super.key,
    required this.onRetry,
    this.onCreateProfile,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Vendor Profile Setup'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: onRetry,
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              try {
                FirebaseAuth.instance.signOut();
              } catch (_) {}
            },
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.storefront_outlined,
                  size: 64,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Complete Your Business Profile',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'You are authenticated with a vendor account, but no active business profile is linked to your user account yet. Set up your business profile to start receiving and responding to client enquiries.',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  key: const Key('create_vendor_profile_button'),
                  icon: const Icon(Icons.add_business),
                  label: const Text('Create Business Profile'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () {
                    if (onCreateProfile != null) {
                      onCreateProfile!();
                    } else {
                      try {
                        context.push('/become-vendor');
                      } catch (_) {}
                    }
                  },
                ),
              ),
              const SizedBox(height: 12),
              TextButton.icon(
                key: const Key('refresh_vendor_profile_button'),
                icon: const Icon(Icons.refresh, color: AppColors.textSecondary, size: 18),
                label: const Text(
                  'Refresh Status',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                onPressed: onRetry,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class VendorAuthWrapper extends StatefulWidget {
  final Widget child;
  final Future<VendorModel?>? vendorFuture;
  final VoidCallback? onCreateProfile;

  const VendorAuthWrapper({
    super.key,
    required this.child,
    this.vendorFuture,
    this.onCreateProfile,
  });

  @override
  State<VendorAuthWrapper> createState() => _VendorAuthWrapperState();
}

class _VendorAuthWrapperState extends State<VendorAuthWrapper> {
  int _refreshCounter = 0;

  void _retry() {
    setState(() {
      _refreshCounter++;
    });
  }

  Widget _buildContent(BuildContext context, AsyncSnapshot<VendorModel?> snapshot) {
    if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (snapshot.hasError) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                const SizedBox(height: 16),
                Text(
                  "Error loading vendor profile: ${snapshot.error}",
                  style: const TextStyle(color: Colors.redAccent),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _retry,
                  child: const Text("Retry"),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final vendor = snapshot.data;
    if (vendor == null || vendor.vendorId.trim().isEmpty) {
      return MissingVendorProfileView(
        onRetry: _retry,
        onCreateProfile: widget.onCreateProfile,
      );
    }

    if (vendor.status != 'active' || !vendor.verified) {
      return VendorPendingApprovalView(
        vendor: vendor,
        onRefresh: _retry,
      );
    }

    return VendorSession(
      vendor: vendor,
      child: widget.child,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.vendorFuture != null) {
      return FutureBuilder<VendorModel?>(
        key: ValueKey('vendor_future_$_refreshCounter'),
        future: widget.vendorFuture,
        builder: _buildContent,
      );
    }

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 48, color: AppColors.textSecondary),
              const SizedBox(height: 16),
              const Text(
                "Authentication required.",
                style: TextStyle(color: Colors.white, fontSize: 16),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: _retry,
                child: const Text("Retry"),
              ),
            ],
          ),
        ),
      );
    }

    return StreamBuilder<VendorModel?>(
      key: ValueKey('vendor_stream_${uid}_$_refreshCounter'),
      stream: VendorRepository.streamVendorByUserId(uid),
      builder: _buildContent,
    );
  }
}


class VendorPendingApprovalView extends StatefulWidget {
  final VendorModel vendor;
  final VoidCallback onRefresh;

  const VendorPendingApprovalView({
    super.key,
    required this.vendor,
    required this.onRefresh,
  });

  @override
  State<VendorPendingApprovalView> createState() => _VendorPendingApprovalViewState();
}

class _VendorPendingApprovalViewState extends State<VendorPendingApprovalView> {
  bool _isChecking = false;

  Future<void> _handleRefresh() async {
    setState(() => _isChecking = true);
    widget.onRefresh();
    try {
      await authStateNotifier.refreshRoleClaims();
    } catch (_) {}
    await Future.delayed(const Duration(milliseconds: 600));
    if (mounted) {
      setState(() => _isChecking = false);
      final isNowApproved = widget.vendor.status == 'active' && widget.vendor.verified;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isNowApproved
                ? 'Vendor profile verified & active! Opening portal...'
                : 'Application status: ${widget.vendor.status.toUpperCase()} (Under review by administrator)',
          ),
          duration: const Duration(seconds: 3),
          backgroundColor: isNowApproved ? Colors.green.shade800 : AppColors.surfaceLighter,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final vendor = widget.vendor;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'PARTNER PORTAL',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            letterSpacing: 2.5,
            color: AppColors.primary,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: _isChecking
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  )
                : const Icon(Icons.refresh_rounded, color: AppColors.primary),
            onPressed: _isChecking ? null : _handleRefresh,
            tooltip: 'Refresh Status',
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary),
            onPressed: () {
              try {
                FirebaseAuth.instance.signOut();
              } catch (_) {}
            },
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 12),
              // Glowing Amber Icon Badge
              Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary.withOpacity(0.08),
                  border: Border.all(
                    color: AppColors.primary.withOpacity(0.4),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.18),
                      blurRadius: 24,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.pending_actions_rounded,
                    size: 44,
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Title
              const Text(
                'Registration Pending Approval',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 0.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),

              // Subtitle
              Text(
                'Welcome, ${vendor.businessName.isNotEmpty ? vendor.businessName : "Partner"}. Your vendor application has been submitted and is currently being reviewed by the Eventology Administration team.',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),

              // Status Chip
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF241C06),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'STATUS: ${vendor.status.toUpperCase()}',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Glassmorphic Application Details Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.storefront_outlined, size: 20, color: AppColors.primary),
                        SizedBox(width: 10),
                        Text(
                          'Business Details',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Divider(color: AppColors.glassBorder, height: 1),
                    const SizedBox(height: 16),
                    _buildDetailRow('Business Name', vendor.businessName),
                    const SizedBox(height: 12),
                    _buildDetailRow('Owner / Contact', vendor.ownerName),
                    if (vendor.email != null && vendor.email!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _buildDetailRow('Email', vendor.email!),
                    ],
                    if (vendor.phone != null && vendor.phone!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _buildDetailRow('Phone', vendor.phone!),
                    ],
                    if (vendor.gstNumber != null && vendor.gstNumber!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _buildDetailRow('GST Number', vendor.gstNumber!),
                    ],
                    const SizedBox(height: 12),
                    _buildDetailRow(
                      'Verification Status',
                      vendor.verified ? 'Verified' : 'Pending Verification',
                      valueColor: vendor.verified ? Colors.greenAccent : AppColors.primary,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Progression Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Next Steps',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildStepRow(
                      icon: Icons.check_circle_rounded,
                      iconColor: Colors.greenAccent,
                      title: '1. Profile Submitted',
                      subtitle: 'Your partner registration details have been securely recorded.',
                    ),
                    const SizedBox(height: 14),
                    _buildStepRow(
                      icon: Icons.hourglass_top_rounded,
                      iconColor: AppColors.primary,
                      title: '2. Admin Approval',
                      subtitle: 'The administrator reviews and approves your business in the administrator dashboard.',
                    ),
                    const SizedBox(height: 14),
                    _buildStepRow(
                      icon: Icons.lock_outline_rounded,
                      iconColor: AppColors.textSecondary,
                      title: '3. Full Access Unlocked',
                      subtitle: 'Receive customer enquiry leads, manage bookings, and communicate directly with clients.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Check Status Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  icon: _isChecking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.black,
                          ),
                        )
                      : const Icon(Icons.refresh_rounded, color: Colors.black),
                  label: Text(
                    _isChecking ? 'Checking...' : 'Check Approval Status',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.black,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: _isChecking ? null : _handleRefresh,
                ),
              ),
              const SizedBox(height: 14),

              // Sign Out Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary, size: 18),
                  label: const Text(
                    'Sign In With Another Account',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.glassBorder),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: () async {
                    try {
                      await FirebaseAuth.instance.signOut();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    } catch (_) {}
                  },
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: valueColor ?? Colors.white,
            ),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    );
  }

  Widget _buildStepRow({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: iconColor, size: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
