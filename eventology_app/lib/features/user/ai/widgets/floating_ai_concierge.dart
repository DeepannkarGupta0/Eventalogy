import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../services/agent_api_service.dart';
import 'agent_chat_panel.dart';
import 'agent_pipeline_tracker.dart';

/// Persistent expandable AI Concierge chat widget mounted on the user shell / home screen.
class FloatingAiConcierge extends StatefulWidget {
  const FloatingAiConcierge({super.key});

  @override
  State<FloatingAiConcierge> createState() => _FloatingAiConciergeState();
}

class _FloatingAiConciergeState extends State<FloatingAiConcierge> {
  bool _isOpen = false;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width >= 960;
    final bottomOffset = isDesktop ? 24.0 : 96.0;
    final rightOffset = isDesktop ? 24.0 : 14.0;

    return Positioned(
      right: rightOffset,
      bottom: bottomOffset,
      child: ListenableBuilder(
        listenable: agentSessionController,
        builder: (context, _) {
          if (!_isOpen) {
            return _buildLauncherPill();
          }

          final panelWidth = isDesktop ? 400.0 : (size.width - 28).clamp(280.0, 390.0);
          final panelHeight = isDesktop
              ? 560.0
              : (size.height - bottomOffset - 90).clamp(320.0, 480.0);

          return Material(
            color: Colors.transparent,
            elevation: 24,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: panelWidth,
              height: panelHeight,
              decoration: BoxDecoration(
                color: const Color(0xFF0E1016),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.45),
                  width: 1.2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.65),
                    blurRadius: 32,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Column(
                  children: [
                    _buildHeader(context),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
                      child: AgentPipelineTracker(
                        controller: agentSessionController,
                        compact: true,
                      ),
                    ),
                    Expanded(
                      child: AgentChatPanel(
                        controller: agentSessionController,
                        isCompact: true,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildLauncherPill() {
    final isStreaming = agentSessionController.isStreaming;
    final hasSession = agentSessionController.conversationId != null;

    return GestureDetector(
      onTap: () => setState(() => _isOpen = true),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFD700), Color(0xFFB8860B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.35),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isStreaming)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
              )
            else
              const Icon(Icons.auto_awesome_rounded, color: Colors.black, size: 18),
            const SizedBox(width: 8),
            Text(
              isStreaming
                  ? 'Agents Running...'
                  : hasSession
                      ? 'Resume AI Plan'
                      : 'AI Event Chat',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF141720),
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.hub_rounded, color: AppColors.primary, size: 16),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Live AI Event Concierge',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                ),
                Text(
                  '14-Agent LangGraph Workspace',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 10),
                ),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () {
              setState(() => _isOpen = false);
              context.push('/ai-chat');
            },
            icon: const Icon(Icons.open_in_full_rounded, size: 13, color: AppColors.primary),
            label: const Text(
              'Split View',
              style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.bold),
            ),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
            ),
          ),
          IconButton(
            onPressed: () => setState(() => _isOpen = false),
            icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary, size: 18),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            tooltip: 'Minimize Chat',
          ),
        ],
      ),
    );
  }
}
