import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../models/agent_workflow_models.dart';
import '../services/agent_api_service.dart';

class AgentPipelineTracker extends StatelessWidget {
  final AgentSessionController controller;
  final bool compact;

  const AgentPipelineTracker({
    super.key,
    required this.controller,
    this.compact = false,
  });

  static const Color _emerald = Color(0xFF10B981);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final snapshot = controller.snapshot;
        final completedSet = {
          ...controller.executedNodes,
          ...(snapshot?.completedTasks ?? const <String>[]),
        };
        final activeNode = controller.activeNode ??
            (controller.isStreaming ? snapshot?.currentAgent : null);
        final isInterrupted = controller.isInterrupted;

        int completedCount = 0;
        for (final node in kAgentPipelineCatalog) {
          if (completedSet.contains(node.nodeId)) {
            completedCount++;
          }
        }

        if (compact) {
          return _buildCompactBar(
            completedCount: completedCount,
            completedSet: completedSet,
            activeNode: activeNode,
            isInterrupted: isInterrupted,
          );
        }

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.hub_rounded,
                      color: AppColors.primary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '14-AGENT LANGGRAPH ORCHESTRATION',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          controller.isStreaming
                              ? 'Active Node: ${_labelFor(activeNode)}'
                              : isInterrupted
                                  ? 'Paused at Human Verification Gate'
                                  : '$completedCount / ${kAgentPipelineCatalog.length} Agents Executed',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: controller.isStreaming
                          ? AppColors.accentBlue.withValues(alpha: 0.16)
                          : _emerald.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: controller.isStreaming
                            ? AppColors.accentBlue.withValues(alpha: 0.45)
                            : _emerald.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (controller.isStreaming)
                          const SizedBox(
                            width: 10,
                            height: 10,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.accentBlue,
                            ),
                          )
                        else
                          Icon(
                            isInterrupted ? Icons.pause_circle_filled : Icons.check_circle,
                            size: 12,
                            color: isInterrupted ? AppColors.primary : _emerald,
                          ),
                        const SizedBox(width: 6),
                        Text(
                          controller.isStreaming
                              ? 'LIVE'
                              : isInterrupted
                                  ? 'AWAITING APPROVAL'
                                  : '$completedCount/14',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: controller.isStreaming
                                ? AppColors.accentBlue
                                : isInterrupted
                                    ? AppColors.primary
                                    : _emerald,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: kAgentPipelineCatalog.map((node) {
                  final isActive = controller.isStreaming && activeNode == node.nodeId;
                  final isDone = completedSet.contains(node.nodeId);
                  final isWaitingGate = isInterrupted &&
                      ((node.nodeId == 'approval_agent' &&
                              snapshot?.approvalStatus == 'pending') ||
                          (node.nodeId == 'technical_review_agent' &&
                              (snapshot?.hasActiveTechnicalHolds ?? false)));

                  Color borderColor = AppColors.glassBorder;
                  Color bgColor = AppColors.surfaceLighter;
                  Color iconColor = AppColors.textSecondary;
                  IconData iconData = Icons.radio_button_unchecked;

                  if (isActive) {
                    borderColor = AppColors.accentBlue;
                    bgColor = AppColors.accentBlue.withValues(alpha: 0.15);
                    iconColor = AppColors.accentBlue;
                    iconData = Icons.sync_rounded;
                  } else if (isWaitingGate) {
                    borderColor = AppColors.primary;
                    bgColor = AppColors.primary.withValues(alpha: 0.14);
                    iconColor = AppColors.primary;
                    iconData = Icons.front_hand_rounded;
                  } else if (isDone) {
                    borderColor = _emerald.withValues(alpha: 0.45);
                    bgColor = _emerald.withValues(alpha: 0.12);
                    iconColor = _emerald;
                    iconData = Icons.check_circle_rounded;
                  }

                  return Tooltip(
                    message: '${node.title} (${node.mode}): ${node.role}',
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                      decoration: BoxDecoration(
                        color: bgColor,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: borderColor),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          isActive
                              ? SizedBox(
                                  width: 12,
                                  height: 12,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: iconColor,
                                  ),
                                )
                              : Icon(iconData, size: 13, color: iconColor),
                          const SizedBox(width: 6),
                          Text(
                            node.title,
                            style: TextStyle(
                              color: isDone || isActive || isWaitingGate
                                  ? Colors.white
                                  : AppColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.35),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              node.mode == 'Deterministic'
                                  ? 'DET'
                                  : node.mode == 'Human Gate'
                                      ? 'GATE'
                                      : node.mode,
                              style: TextStyle(
                                color: node.mode == 'Deterministic'
                                    ? AppColors.accentPurple
                                    : node.mode == 'Human Gate'
                                        ? AppColors.primary
                                        : AppColors.textSecondary,
                                fontSize: 8.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCompactBar({
    required int completedCount,
    required Set<String> completedSet,
    required String? activeNode,
    required bool isInterrupted,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLighter,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (controller.isStreaming)
                const SizedBox(
                  width: 12,
                  height: 12,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                )
              else
                Icon(
                  isInterrupted ? Icons.pause_circle : Icons.hub_rounded,
                  size: 14,
                  color: AppColors.primary,
                ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  controller.isStreaming
                      ? 'Running ${_labelFor(activeNode)}...'
                      : isInterrupted
                          ? 'Awaiting verification gate ($completedCount/14)'
                          : '$completedCount / 14 agents ready',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                '$completedCount/14',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: kAgentPipelineCatalog.map((node) {
              final isActive = controller.isStreaming && activeNode == node.nodeId;
              final isDone = completedSet.contains(node.nodeId);
              return Expanded(
                child: Container(
                  height: 3,
                  margin: const EdgeInsets.symmetric(horizontal: 1),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    color: isActive
                        ? AppColors.primary
                        : isDone
                            ? _emerald
                            : Colors.white12,
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  String _labelFor(String? nodeId) {
    if (nodeId == null || nodeId.isEmpty) return 'Orchestrator';
    for (final item in kAgentPipelineCatalog) {
      if (item.nodeId == nodeId) return item.title;
    }
    return nodeId;
  }
}
