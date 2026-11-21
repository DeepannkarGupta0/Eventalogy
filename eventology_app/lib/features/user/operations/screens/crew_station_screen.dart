import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../models/live_operations_models.dart';
import '../services/live_operations_client_service.dart';

class CrewStationScreen extends StatefulWidget {
  final String eventId;
  final String initialStationId;
  final String? eventTitle;

  const CrewStationScreen({
    super.key,
    required this.eventId,
    this.initialStationId = 'foh_audio',
    this.eventTitle,
  });

  @override
  State<CrewStationScreen> createState() => _CrewStationScreenState();
}

class _CrewStationScreenState extends State<CrewStationScreen> {
  final LiveOperationsClientService _service = LiveOperationsClientService();
  late String _selectedStationId;
  LiveOperationsSession? _session;
  StreamSubscription<LiveOperationsSession>? _streamSubscription;
  bool _isLoading = true;
  String? _errorMessage;

  final Map<String, Map<String, dynamic>> _stationConfig = {
    'foh_audio': {
      'name': 'FOH Audio Mix',
      'role': 'A1 Audio Lead',
      'icon': Icons.volume_up_outlined,
      'color': Colors.cyanAccent,
      'dept': 'audio',
    },
    'lighting_ld': {
      'name': 'Lighting Console',
      'role': 'Lead LD Designer',
      'icon': Icons.lightbulb_outline,
      'color': Colors.amberAccent,
      'dept': 'lighting',
    },
    'video_director': {
      'name': 'Video & LED Control',
      'role': 'V1 Video Director',
      'icon': Icons.tv_outlined,
      'color': Colors.purpleAccent,
      'dept': 'video',
    },
    'stage_manager': {
      'name': 'Stage Left Caller',
      'role': 'Production Stage Manager',
      'icon': Icons.record_voice_over_outlined,
      'color': Colors.blueAccent,
      'dept': 'staging',
    },
    'rigging_lead': {
      'name': 'Rigging & Truss Lead',
      'role': 'Head Rigger',
      'icon': Icons.architecture_outlined,
      'color': Colors.orangeAccent,
      'dept': 'rigging',
    },
    'catering_lead': {
      'name': 'Banquet & Hospitality',
      'role': 'Catering Supervisor',
      'icon': Icons.restaurant_outlined,
      'color': Colors.greenAccent,
      'dept': 'catering',
    },
    'security_lead': {
      'name': 'Perimeter Safety',
      'role': 'Chief Security Officer',
      'icon': Icons.security_outlined,
      'color': Colors.redAccent,
      'dept': 'security',
    },
  };

  @override
  void initState() {
    super.initState();
    _selectedStationId = widget.initialStationId;
    _startLiveStream();
  }

  @override
  void dispose() {
    _streamSubscription?.cancel();
    super.dispose();
  }

  void _startLiveStream() {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    _streamSubscription?.cancel();
    _streamSubscription = _service.streamSession(widget.eventId).listen(
      (session) {
        if (mounted) {
          setState(() {
            _session = session;
            _isLoading = false;
          });
        }
      },
      onError: (err) {
        if (mounted && _session == null) {
          setState(() {
            _errorMessage = err.toString();
            _isLoading = false;
          });
        }
      },
    );
  }

  StationTelemetry? get _currentTelemetry {
    if (_session == null) return null;
    return _session!.stations[_selectedStationId];
  }

  Future<void> _toggleReadyStatus() async {
    final telemetry = _currentTelemetry;
    if (telemetry == null) return;

    final newStatus = telemetry.status == 'CHECKED_IN' ? 'STANDBY' : 'CHECKED_IN';
    final updated = await _service.updateStationTelemetry(
      widget.eventId,
      _selectedStationId,
      newStatus,
      operatorName: telemetry.operatorName,
    );
    if (mounted) {
      setState(() {
        _session = updated;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Station reported $newStatus to Stage Manager'),
          backgroundColor: newStatus == 'CHECKED_IN' ? Colors.green.shade800 : Colors.amber.shade900,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _openReportIssueModal() {
    final telemetry = _currentTelemetry;
    final textController = TextEditingController(text: telemetry?.activeIssue ?? '');
    String selectedStatus = 'ACTION_REQUIRED';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          backgroundColor: const Color(0xFF1B202D),
          title: Row(
            children: [
              const Icon(Icons.report_problem_outlined, color: Colors.orangeAccent),
              const SizedBox(width: 8),
              Text(
                'Report Issue: ${_stationConfig[_selectedStationId]?['name']}',
                style: const TextStyle(fontSize: 15, color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Severity / Status:', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Row(
                children: [
                  ChoiceChip(
                    label: const Text('ATTENTION REQUIRED', style: TextStyle(fontSize: 10)),
                    selected: selectedStatus == 'ACTION_REQUIRED',
                    selectedColor: Colors.orangeAccent,
                    onSelected: (val) {
                      if (val) setModalState(() => selectedStatus = 'ACTION_REQUIRED');
                    },
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('CRITICAL', style: TextStyle(fontSize: 10)),
                    selected: selectedStatus == 'CRITICAL_ISSUE',
                    selectedColor: Colors.redAccent,
                    onSelected: (val) {
                      if (val) setModalState(() => selectedStatus = 'CRITICAL_ISSUE');
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text('Quick Observation Presets:', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  'Signal / RF Dropout',
                  'Cable Slack',
                  'Power Fluctuation',
                  'Talent Late',
                  'Catering Service Lag',
                  'All Clear',
                ].map((preset) {
                  return ActionChip(
                    label: Text(preset, style: const TextStyle(fontSize: 10, color: Colors.white)),
                    backgroundColor: const Color(0xFF252C3D),
                    onPressed: () {
                      if (preset == 'All Clear') {
                        textController.clear();
                        setModalState(() => selectedStatus = 'CHECKED_IN');
                      } else {
                        textController.text = preset;
                      }
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textController,
                decoration: const InputDecoration(
                  labelText: 'Custom Notes for Stage Manager',
                  border: OutlineInputBorder(),
                ),
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () async {
                Navigator.pop(ctx);
                final updated = await _service.updateStationTelemetry(
                  widget.eventId,
                  _selectedStationId,
                  selectedStatus,
                  activeIssue: textController.text.trim().isEmpty ? null : textController.text.trim(),
                );
                if (mounted) {
                  setState(() {
                    _session = updated;
                  });
                }
              },
              child: const Text('Send Alert', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'CHECKED_IN':
        return Colors.greenAccent;
      case 'STANDBY':
        return Colors.amberAccent;
      case 'ACTION_REQUIRED':
        return Colors.orangeAccent;
      case 'CRITICAL_ISSUE':
        return Colors.redAccent;
      case 'OFFLINE':
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = _stationConfig[_selectedStationId] ?? _stationConfig['foh_audio']!;
    final stationName = config['name'] as String;
    final stationRole = config['role'] as String;
    final stationIcon = config['icon'] as IconData;
    final stationColor = config['color'] as Color;

    return Scaffold(
      backgroundColor: const Color(0xFF0F1117),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161922),
        elevation: 0,
        title: Row(
          children: [
            Icon(stationIcon, color: stationColor, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    stationName,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  Text(
                    '$stationRole • ${widget.eventTitle ?? "Main Stage Production"}',
                    style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Station Selector Dropdown
          DropdownButton<String>(
            value: _selectedStationId,
            dropdownColor: const Color(0xFF1B202D),
            underline: const SizedBox.shrink(),
            icon: const Icon(Icons.swap_horiz, color: Colors.white70),
            items: _stationConfig.entries.map((e) {
              return DropdownMenuItem<String>(
                value: e.key,
                child: Row(
                  children: [
                    Icon(e.value['icon'] as IconData, size: 14, color: e.value['color'] as Color),
                    const SizedBox(width: 8),
                    Text(e.value['name'] as String, style: const TextStyle(fontSize: 12, color: Colors.white)),
                  ],
                ),
              );
            }).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedStationId = val);
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent)))
              : _session == null
                  ? const Center(child: Text('No active session found', style: TextStyle(color: Colors.white)))
                  : _buildStationDashboard(config),
    );
  }

  Widget _buildStationDashboard(Map<String, dynamic> config) {
    final session = _session!;
    final telemetry = _currentTelemetry;
    final isHold = session.isAllStopHeld;
    final currentStatus = telemetry?.status ?? 'CHECKED_IN';
    final hasIssue = telemetry?.activeIssue != null && telemetry!.activeIssue!.isNotEmpty;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Emergency Safety Hold Alert
          if (isHold) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.shade900,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.redAccent, width: 2),
              ),
              child: Row(
                children: [
                  const Icon(Icons.emergency, color: Colors.white, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SAFETY ALL-STOP ENGAGED',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                        ),
                        Text(
                          session.allStopReason ?? 'All stage actions frozen by Stage Manager.',
                          style: const TextStyle(fontSize: 12, color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // 2. Station Operator Readiness Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1B202D),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _getStatusColor(currentStatus).withValues(alpha: 0.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: _getStatusColor(currentStatus),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'STATION STATUS: $currentStatus',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: _getStatusColor(currentStatus),
                          ),
                        ),
                      ],
                    ),
                    InkWell(
                      onTap: _openReportIssueModal,
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: hasIssue ? Colors.orange.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.05),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: hasIssue ? Colors.orangeAccent : Colors.white24),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.report_problem, size: 14, color: hasIssue ? Colors.orangeAccent : Colors.white70),
                            const SizedBox(width: 4),
                            Text(
                              hasIssue ? 'Active Issue' : 'Report Issue',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: hasIssue ? Colors.orangeAccent : Colors.white70,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                if (hasIssue) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Observation: ${telemetry.activeIssue}',
                    style: const TextStyle(fontSize: 12, color: Colors.orangeAccent, fontStyle: FontStyle.italic),
                  ),
                ],
                const SizedBox(height: 14),

                // Giant 1-Tap Ready Button
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: currentStatus == 'CHECKED_IN' ? const Color(0xFF00E676) : Colors.amberAccent,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: Icon(
                    currentStatus == 'CHECKED_IN' ? Icons.check_circle : Icons.pan_tool_alt,
                    size: 20,
                  ),
                  label: Text(
                    currentStatus == 'CHECKED_IN' ? 'STATION READY (ACKNOWLEDGED)' : 'ACKNOWLEDGE STANDBY (TAP READY)',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5),
                  ),
                  onPressed: _toggleReadyStatus,
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // 3. Current Live Cue with Departmental Focus
          _buildDepartmentActiveCue(session, config['dept'] as String),

          const SizedBox(height: 20),

          // 4. Department Filtered Cue Schedule
          _buildDepartmentCueSchedule(session, config['dept'] as String),
        ],
      ),
    );
  }

  Widget _buildDepartmentActiveCue(LiveOperationsSession session, String dept) {
    final activeCue = session.cues.isNotEmpty && session.currentCueIndex < session.cues.length
        ? session.cues[session.currentCueIndex]
        : null;

    if (activeCue == null) {
      return const SizedBox.shrink();
    }

    final String? deptInstruction = _getDepartmentInstruction(activeCue, dept);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF161A24),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: activeCue.executionStatus == 'ACTIVE' ? Colors.greenAccent : AppColors.glassBorder,
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'NOW LIVE • ${activeCue.cueNumber}',
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 11),
                ),
              ),
              Text(
                activeCue.scheduledTime,
                style: const TextStyle(fontFamily: 'monospace', color: AppColors.textSecondary, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            activeCue.title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 14),

          // High-contrast Department Instruction Highlight
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1117),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.cyanAccent.withValues(alpha: 0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.tune, color: Colors.cyanAccent, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'YOUR STATION CALLOUT',
                      style: TextStyle(fontFamily: 'monospace', fontSize: 11, fontWeight: FontWeight.bold, color: Colors.cyanAccent),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  deptInstruction ?? activeCue.actionSummary,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDepartmentCueSchedule(LiveOperationsSession session, String dept) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'UPCOMING CUES FOR THIS STATION',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.0, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 10),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: session.cues.length,
          separatorBuilder: (context, index) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final cue = session.cues[index];
            final isCurrent = index == session.currentCueIndex;
            final deptInstruction = _getDepartmentInstruction(cue, dept);

            return Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isCurrent ? const Color(0xFF22293A) : const Color(0xFF161A24),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isCurrent ? AppColors.primary : AppColors.glassBorder,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${cue.cueNumber} • ${cue.title}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                          color: isCurrent ? Colors.white : Colors.white70,
                        ),
                      ),
                      Text(
                        cue.scheduledTime,
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  if (deptInstruction != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      deptInstruction,
                      style: const TextStyle(fontSize: 11, color: Colors.cyanAccent),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  String? _getDepartmentInstruction(LiveCueState cue, String dept) {
    switch (dept) {
      case 'audio':
        return cue.audioCue;
      case 'lighting':
        return cue.lightingCue;
      case 'video':
        return cue.videoCue;
      case 'staging':
        return cue.stageCue ?? cue.actionSummary;
      case 'rigging':
        return cue.contingencyAction ?? cue.actionSummary;
      case 'catering':
        return cue.actionSummary;
      case 'security':
        return cue.contingencyAction ?? 'Perimeter clear';
      default:
        return cue.actionSummary;
    }
  }
}
