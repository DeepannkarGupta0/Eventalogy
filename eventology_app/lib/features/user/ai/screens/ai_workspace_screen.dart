import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../models/agent_workflow_models.dart';
import '../services/agent_api_service.dart';
import '../widgets/agent_chat_panel.dart';
import '../widgets/agent_pipeline_tracker.dart';

/// Split-screen workspace pairing the live 14-agent orchestration results
/// directly beside the interactive AI Chat panel.
class AiWorkspaceScreen extends StatefulWidget {
  final String? initialMessage;
  final String? conversationId;
  final String? eventId;
  final Map<String, dynamic>? initialRequirements;
  final bool autoOpenChat;

  const AiWorkspaceScreen({
    super.key,
    this.initialMessage,
    this.conversationId,
    this.eventId,
    this.initialRequirements,
    this.autoOpenChat = false,
  });

  @override
  State<AiWorkspaceScreen> createState() => _AiWorkspaceScreenState();
}

class _AiWorkspaceScreenState extends State<AiWorkspaceScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _mobileTabCtrl;
  bool _initialized = false;

  static const Color _emerald = Color(0xFF10B981);

  @override
  void initState() {
    super.initState();
    _mobileTabCtrl = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.autoOpenChat ? 1 : 0,
    );

    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrapSession());
  }

  Future<void> _bootstrapSession() async {
    if (_initialized) return;
    _initialized = true;

    if (widget.conversationId != null && widget.conversationId!.isNotEmpty) {
      await agentSessionController.loadExistingConversation(widget.conversationId!);
      return;
    }

    if (widget.initialMessage != null && widget.initialMessage!.trim().isNotEmpty) {
      if (widget.initialRequirements != null &&
          widget.initialRequirements!.isNotEmpty) {
        await agentSessionController.startFromFiveStepPlanner(
          summaryPrompt: widget.initialMessage!,
          requirements: widget.initialRequirements!,
          eventId: widget.eventId,
        );
      } else {
        await agentSessionController.sendMessage(
          widget.initialMessage!,
          eventId: widget.eventId,
          forceNew: true,
        );
      }
    }
  }

  @override
  void dispose() {
    _mobileTabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 960;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0E1119),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
        ),
        title: const Row(
          children: [
            Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 18),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'AI EVENT PRODUCTION WORKSPACE',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  letterSpacing: 1.4,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton.icon(
            onPressed: () => context.go('/planner'),
            icon: const Icon(Icons.tune_rounded, size: 15, color: AppColors.primary),
            label: const Text(
              '5-Step Planner',
              style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
          IconButton(
            onPressed: () => agentSessionController.resetSession(),
            tooltip: 'New AI Thread',
            icon: const Icon(Icons.refresh_rounded, color: AppColors.textSecondary, size: 20),
          ),
          const SizedBox(width: 8),
        ],
        bottom: isDesktop
            ? null
            : TabBar(
                controller: _mobileTabCtrl,
                indicatorColor: AppColors.primary,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textSecondary,
                tabs: const [
                  Tab(icon: Icon(Icons.analytics_outlined, size: 18), text: 'Plan & 14 Agents'),
                  Tab(icon: Icon(Icons.chat_bubble_outline_rounded, size: 18), text: 'Live Chat UI'),
                ],
              ),
      ),
      body: isDesktop
          ? Row(
              children: [
                Expanded(
                  flex: 6,
                  child: _buildResultsPane(isDesktop: true),
                ),
                Container(width: 1, color: AppColors.glassBorder),
                Expanded(
                  flex: 4,
                  child: _buildChatSidebar(),
                ),
              ],
            )
          : TabBarView(
              controller: _mobileTabCtrl,
              children: [
                _buildResultsPane(isDesktop: false),
                _buildChatSidebar(),
              ],
            ),
    );
  }

  Widget _buildChatSidebar() {
    return Container(
      color: const Color(0xFF0A0C12),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFF10131C),
              border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
            ),
            child: const Row(
              children: [
                Icon(Icons.forum_rounded, color: AppColors.primary, size: 17),
                SizedBox(width: 8),
                Text(
                  'AI Concierge Chat & Approvals',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          Expanded(
            child: AgentChatPanel(controller: agentSessionController),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsPane({required bool isDesktop}) {
    return ListenableBuilder(
      listenable: agentSessionController,
      builder: (context, _) {
        final snapshot = agentSessionController.snapshot;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AgentPipelineTracker(controller: agentSessionController),
              const SizedBox(height: 18),
              if (!isDesktop)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _mobileTabCtrl.animateTo(1),
                      icon: const Icon(Icons.chat_rounded, size: 16, color: AppColors.primary),
                      label: const Text(
                        'Open AI Chat Alongside Plan',
                        style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ),
              if (snapshot == null)
                _buildAwaitingResultsCard()
              else ...[
                _buildRequirementsCard(snapshot),
                const SizedBox(height: 16),
                if (snapshot.eventPlan != null) ...[
                  _buildEventPlanCard(snapshot.eventPlan!),
                  const SizedBox(height: 16),
                ],
                if (snapshot.candidateVenues.isNotEmpty ||
                    snapshot.candidateVendors.isNotEmpty ||
                    snapshot.candidateVenueCount > 0 ||
                    snapshot.candidateVendorCount > 0) ...[
                  _buildShortlistCard(snapshot),
                  const SizedBox(height: 16),
                ],
                if (snapshot.budgetBreakdown != null) ...[
                  _buildBudgetCard(snapshot.budgetBreakdown!),
                  const SizedBox(height: 16),
                ],
                if (snapshot.artifacts.isNotEmpty || snapshot.technicalReviews.isNotEmpty) ...[
                  _buildEngineeringArtifactsCard(snapshot),
                  const SizedBox(height: 16),
                ],
                if (snapshot.createdBookingIds.isNotEmpty || snapshot.eventId != null)
                  _buildCreatedRecordsCard(snapshot),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildAwaitingResultsCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Icon(
            agentSessionController.isStreaming
                ? Icons.auto_awesome_motion_rounded
                : Icons.architecture_rounded,
            size: 36,
            color: AppColors.primary,
          ),
          const SizedBox(height: 12),
          Text(
            agentSessionController.isStreaming
                ? 'Agents are collaborating sequentially and in parallel...'
                : 'Complete the 5-Step Planner or send a message in the Chat UI.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          const Text(
            'As Orchestrator, Intake, Planning, Venue/Vendor/Service search, Availability, Budget, Engineering Physics, and Logistics complete, your production blueprint will populate here live.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildRequirementsCard(AgentStateSnapshot s) {
    final req = s.eventRequirements;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CAPTURED EVENT SPECIFICATIONS',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _specChip(Icons.celebration_rounded, 'Type', req['eventType']?.toString() ?? 'Pending'),
              _specChip(Icons.location_on_outlined, 'City', req['location']?.toString() ?? 'Pending'),
              _specChip(Icons.groups_rounded, 'Guests', req['guestCount']?.toString() ?? 'Pending'),
              _specChip(Icons.calendar_today_rounded, 'Date', req['dateStr']?.toString() ?? 'Pending'),
              _specChip(Icons.currency_rupee_rounded, 'Budget', req['budgetStr']?.toString() ?? 'Flexible'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _specChip(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            '$label: ',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11.5),
          ),
          Text(
            value,
            style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildEventPlanCard(Map<String, dynamic> plan) {
    final title = plan['title']?.toString() ?? 'Custom Production Plan';
    final summary = plan['summary']?.toString() ?? '';
    final services = (plan['requiredServices'] as List?)?.map((e) => e.toString()).toList() ?? [];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'GENERATED PRODUCTION PLAN',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          if (summary.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              summary,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.5),
            ),
          ],
          if (services.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: services
                  .map(
                    (srv) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        srv,
                        style: const TextStyle(color: AppColors.primaryLight, fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildShortlistCard(AgentStateSnapshot s) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'SPECIALIST SEARCH & AVAILABILITY',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
              Text(
                '${s.availableVenueCount}/${s.candidateVenueCount} Venues · ${s.availableVendorCount}/${s.candidateVendorCount} Vendors Available',
                style: const TextStyle(color: _emerald, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          if (s.candidateVenues.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('Shortlisted Venues', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            ...s.candidateVenues.take(4).map(
                  (v) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.castle_rounded, color: AppColors.primary, size: 18),
                    title: Text(
                      (v['name'] ?? v['venueName'] ?? 'Venue').toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                    subtitle: Text(
                      'Capacity: ${v['capacity'] ?? 'N/A'} · ${v['location'] ?? v['city'] ?? ''}',
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ),
                ),
          ],
          if (s.candidateVendors.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Text('Shortlisted Vendors', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            ...s.candidateVendors.take(5).map(
                  (v) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.engineering_rounded, color: AppColors.accentBlue, size: 18),
                    title: Text(
                      (v['businessName'] ?? v['name'] ?? 'Vendor').toString(),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                    subtitle: Text(
                      (v['category'] ?? v['serviceName'] ?? 'Production Vendor').toString(),
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _buildBudgetCard(AgentBudgetBreakdown budget) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ITEMIZED BUDGET & BOM',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
              Text(
                '₹${budget.totalEstimatedCost.toStringAsFixed(0)}',
                style: const TextStyle(color: _emerald, fontSize: 17, fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...budget.lineItems.map(
            (item) => Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.surfaceLighter,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.item, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
                        Text(item.category, style: const TextStyle(color: AppColors.textSecondary, fontSize: 10.5)),
                      ],
                    ),
                  ),
                  Text(
                    '₹${item.cost.toStringAsFixed(0)}',
                    style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEngineeringArtifactsCard(AgentStateSnapshot s) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ENGINEERING PHYSICS & LOGISTICS OUTPUTS',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.4,
                ),
              ),
              Text(
                '${s.artifacts.length} Artifacts',
                style: const TextStyle(color: AppColors.accentPurple, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...s.artifacts.take(6).map(
                (a) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.description_outlined, color: AppColors.primary, size: 18),
                  title: Text(
                    (a['title'] ?? 'Production Artifact').toString(),
                    style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    '${a['type'] ?? 'doc'} · ${a['status'] ?? 'draft'}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                  ),
                ),
              ),
          if (s.workflowId.isNotEmpty) ...[
            const SizedBox(height: 8),
            ElevatedButton.icon(
              onPressed: () => context.push(
                '/procurement/${s.workflowId}',
                extra: {'eventName': s.eventPlan?['title']?.toString() ?? 'Event Procurement'},
              ),
              icon: const Icon(Icons.gavel_rounded, size: 16),
              label: const Text('Open Vendor RFQ Procurement', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.surfaceLighter,
                foregroundColor: AppColors.primary,
                side: BorderSide(color: AppColors.primary.withValues(alpha: 0.4)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCreatedRecordsCard(AgentStateSnapshot s) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _emerald.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _emerald.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: _emerald, size: 18),
              SizedBox(width: 8),
              Text(
                'EVENT & BOOKINGS COMMITTED',
                style: TextStyle(color: _emerald, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Bookings Created: ${s.createdBookingIds.length} · Enquiries: ${s.createdEnquiryIds.length}',
            style: const TextStyle(color: Colors.white, fontSize: 12.5),
          ),
          if (s.eventId != null && s.eventId!.isNotEmpty) ...[
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: () => context.push('/my-events/${s.eventId}'),
              style: ElevatedButton.styleFrom(backgroundColor: _emerald, foregroundColor: Colors.black),
              child: const Text('Open Event Production Studio', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ],
      ),
    );
  }
}
