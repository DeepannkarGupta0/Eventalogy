import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../models/live_operations_models.dart';
import '../services/live_operations_client_service.dart';

class LiveRunOfShowScreen extends StatefulWidget {
  final String eventId;
  final String? eventTitle;

  const LiveRunOfShowScreen({
    super.key,
    required this.eventId,
    this.eventTitle,
  });

  @override
  State<LiveRunOfShowScreen> createState() => _LiveRunOfShowScreenState();
}

class _LiveRunOfShowScreenState extends State<LiveRunOfShowScreen> {
  final LiveOperationsClientService _service = LiveOperationsClientService();
  LiveOperationsSession? _session;
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _clockTimer;
  StreamSubscription<LiveOperationsSession>? _streamSubscription;
  DateTime _currentTime = DateTime.now();
  String _selectedFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _startLiveStream();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _currentTime = DateTime.now();
        });
      }
    });
  }

  @override
  void dispose() {
    _streamSubscription?.cancel();
    _clockTimer?.cancel();
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

  Future<void> _loadSession() async {
    _startLiveStream();
  }

  Future<void> _triggerCueAction(String cueNumber, String action) async {
    try {
      final updated = await _service.triggerCue(widget.eventId, cueNumber, action);
      if (mounted) {
        setState(() {
          _session = updated;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cue $cueNumber transitioned to $action'),
            backgroundColor: action == 'GO' ? Colors.green.shade800 : AppColors.surfaceHighlight,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        _showSafetyAlert(e.toString());
      }
    }
  }

  void _showSafetyAlert(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 28),
            SizedBox(width: 8),
            Text('Safety Hold Active', style: TextStyle(color: Colors.white, fontSize: 18)),
          ],
        ),
        content: Text(
          message,
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Acknowledge', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  Future<void> _engageSafetyAllStop() async {
    final reasonController = TextEditingController(text: 'Visual obstruction / rigging safety check');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.emergency, color: Colors.red, size: 28),
            SizedBox(width: 8),
            Text('EMERGENCY ALL-STOP', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Engaging All-Stop immediately halts active cues and places the entire production into SAFETY HOLD.',
              style: TextStyle(color: AppColors.textPrimary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Emergency Hold Reason',
                border: OutlineInputBorder(),
              ),
              style: const TextStyle(color: Colors.white),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ENGAGE ALL-STOP', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final updated = await _service.triggerSafetyHold(widget.eventId, reasonController.text.trim());
      setState(() {
        _session = updated;
      });
    }
  }

  Future<void> _releaseSafetyHold() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Release Safety All-Stop', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Confirm that the stage, electrical, and rigging hazards have been cleared and human sign-off is granted to resume cue execution.',
          style: TextStyle(color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Hold', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('RELEASE HOLD', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final updated = await _service.releaseSafetyHold(widget.eventId);
      setState(() {
        _session = updated;
      });
    }
  }

  void _openStationTelemetryDialog(StationTelemetry station) {
    String currentStatus = station.status;
    final issueController = TextEditingController(text: station.activeIssue ?? '');

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.surface,
          title: Text('Station: ${station.stationName}', style: const TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Operator: ${station.operatorName}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              const SizedBox(height: 16),
              const Text('Readiness Status:', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  'CHECKED_IN',
                  'STANDBY',
                  'ACTION_REQUIRED',
                  'CRITICAL_ISSUE',
                  'OFFLINE',
                ].map((s) {
                  final isSel = currentStatus == s;
                  return ChoiceChip(
                    label: Text(s, style: TextStyle(fontSize: 11, color: isSel ? Colors.black : Colors.white)),
                    selected: isSel,
                    selectedColor: _getStatusColor(s),
                    backgroundColor: AppColors.surfaceHighlight,
                    onSelected: (val) {
                      if (val) setDialogState(() => currentStatus = s);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: issueController,
                decoration: const InputDecoration(
                  labelText: 'Active Observation / Issue Notes',
                  border: OutlineInputBorder(),
                ),
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ],
          ),
          actions: [
            OutlinedButton.icon(
              icon: const Icon(Icons.open_in_new, size: 14),
              label: const Text('Open Station Console', style: TextStyle(fontSize: 12)),
              onPressed: () {
                Navigator.pop(ctx);
                context.push(
                  '/operations/session/${widget.eventId}/station/${station.stationId}',
                  extra: {'eventTitle': widget.eventTitle},
                );
              },
            ),
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
                  station.stationId,
                  currentStatus,
                  activeIssue: issueController.text.trim().isEmpty ? null : issueController.text.trim(),
                );
                if (mounted) {
                  setState(() {
                    _session = updated;
                  });
                }
              },
              child: const Text('Save Telemetry', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
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

  String _formatTimecode(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    final s = dt.second.toString().padLeft(2, '0');
    final f = (dt.millisecond ~/ 40).toString().padLeft(2, '0'); // SMPTE approx 25fps frame
    return '$h:$m:$s:$f';
  }

  Future<void> _openCurfewRecoveryDialog() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(
        child: CircularProgressIndicator(color: Colors.amberAccent),
      ),
    );

    Map<String, dynamic> proposal = {};
    try {
      proposal = await _service.fetchCurfewAnalysis(widget.eventId);
    } catch (_) {}

    if (mounted) {
      Navigator.pop(context); // Dismiss loader
      _showCurfewProposalDialog(proposal);
    }
  }

  void _showCurfewProposalDialog(Map<String, dynamic> proposal) {
    final isAtRisk = proposal['isCurfewAtRisk'] == true;
    final curfewTime = proposal['curfewTime'] as String? ?? '23:00:00';
    final origFinish = proposal['originalProjectedFinishTime'] as String? ?? '23:25:00';
    final compFinish = proposal['compressedProjectedFinishTime'] as String? ?? '22:55:00';
    final plan = (proposal['compressionPlan'] as List<dynamic>? ?? []);
    final rationale = proposal['reasoningSummary'] as String? ?? 'Curfew compression calculated.';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E2433),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              isAtRisk ? Icons.warning_amber_rounded : Icons.check_circle_outline,
              color: isAtRisk ? Colors.amberAccent : Colors.greenAccent,
            ),
            const SizedBox(width: 8),
            const Text(
              'Curfew Recovery Sentinel',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: SizedBox(
          width: 500,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isAtRisk ? Colors.red.withOpacity(0.15) : Colors.green.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isAtRisk
                          ? Colors.redAccent.withOpacity(0.5)
                          : Colors.greenAccent.withOpacity(0.5),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('PROJECTED FINISH',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 10)),
                          Text(origFinish,
                              style: const TextStyle(
                                  color: Colors.redAccent, fontSize: 15, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const Icon(Icons.arrow_forward, color: Colors.white54, size: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('RECOVERED FINISH',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 10)),
                          Text(compFinish,
                              style: const TextStyle(
                                  color: Colors.greenAccent, fontSize: 15, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('CURFEW LIMIT',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 10)),
                          Text(curfewTime,
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Recommended Buffer Reductions:',
                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ...plan.map((item) {
                  final map = item as Map<String, dynamic>;
                  final cueNum = map['cueNumber'] ?? '';
                  final title = map['title'] ?? '';
                  final redSec = (map['reductionSeconds'] as num?)?.toInt() ?? 0;
                  final redMin = redSec ~/ 60;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF131722),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text('$cueNum: $title',
                              style: const TextStyle(color: Colors.white, fontSize: 12)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('-$redMin min',
                              style: const TextStyle(
                                  color: Colors.amberAccent,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 8),
                Text(
                  rationale,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 11, fontStyle: FontStyle.italic),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Dismiss', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber.shade800),
            onPressed: () async {
              Navigator.pop(ctx);
              final updated = await _service.applyCurfewCompression(widget.eventId,
                  curfewTime: curfewTime);
              if (mounted) {
                setState(() {
                  _session = updated;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('AI Curfew Compression applied. Downstream cues recalculated.'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
            },
            child: const Text('Apply Curfew Compression',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _handleExportCsv() async {
    try {
      final csv = await _service.exportCallSheetCsv(widget.eventId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Run of Show Call Sheet exported (${csv.split('\n').length} lines)'),
            backgroundColor: AppColors.surfaceHighlight,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _handleExportPdf() async {
    try {
      final res = await _service.exportCallSheetPdf(widget.eventId);
      final hash = res['sha256Hash'] as String? ?? 'N/A';
      final pages = res['pageCount'] as int? ?? 1;

      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E2433),
            title: const Row(
              children: [
                Icon(Icons.picture_as_pdf, color: Colors.redAccent),
                SizedBox(width: 8),
                Text('Call Sheet PDF Ready', style: TextStyle(color: Colors.white, fontSize: 16)),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Generated broadcast-grade Landscape A4 Call Sheet ($pages page).',
                    style: const TextStyle(color: Colors.white, fontSize: 13)),
                const SizedBox(height: 12),
                const Text('SHA-256 Verification Hash:',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                const SizedBox(height: 4),
                SelectableText(
                  hash,
                  style: const TextStyle(
                      color: Colors.cyanAccent, fontFamily: 'monospace', fontSize: 10),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('PDF Export failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1117), // High-contrast dark room stage console
      appBar: AppBar(
        backgroundColor: const Color(0xFF161922),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.2),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.fiber_manual_record, color: Colors.redAccent, size: 12),
                  SizedBox(width: 4),
                  Text('LIVE ROS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                widget.eventTitle ?? 'Main Stage Run of Show',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.timer_outlined, color: Colors.amberAccent),
            onPressed: _openCurfewRecoveryDialog,
            tooltip: 'Curfew Sentinel',
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.file_download_outlined, color: Colors.cyanAccent),
            tooltip: 'Export Master Call Sheet',
            color: const Color(0xFF1E2433),
            onSelected: (val) {
              if (val == 'CSV') {
                _handleExportCsv();
              } else if (val == 'PDF') {
                _handleExportPdf();
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'PDF',
                child: Row(
                  children: [
                    Icon(Icons.picture_as_pdf, color: Colors.redAccent, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text('Export Call Sheet (PDF)',
                          style: TextStyle(color: Colors.white, fontSize: 13),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'CSV',
                child: Row(
                  children: [
                    Icon(Icons.table_chart_outlined, color: Colors.greenAccent, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text('Export Cue Sheet (CSV)',
                          style: TextStyle(color: Colors.white, fontSize: 13),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: _loadSession,
            tooltip: 'Refresh Telemetry',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent)))
              : _session == null
                  ? const Center(child: Text('No session data found', style: TextStyle(color: Colors.white)))
                  : _buildLiveDashboard(),
    );
  }

  Widget _buildLiveDashboard() {
    final session = _session!;
    final isHold = session.isAllStopHeld;

    return Column(
      children: [
        // 1. Timecode & Emergency Safety Bar
        _buildMasterClockBar(session),

        if (isHold) _buildEmergencyHoldBanner(session),

        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 2. Active Cue Execution Cockpit (Hero)
                _buildActiveCueHero(session),

                const SizedBox(height: 16),

                // 3. Multi-Party Crew Station Telemetry Bar
                _buildStationTelemetrySection(session),

                const SizedBox(height: 20),

                // 4. Chronological Cue Sheet Table
                _buildCueSheetSection(session),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMasterClockBar(LiveOperationsSession session) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: const Color(0xFF1A1E29),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.access_time_filled, color: Colors.cyanAccent, size: 20),
              const SizedBox(width: 8),
              Text(
                _formatTimecode(_currentTime),
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2.0,
                  color: Colors.cyanAccent,
                ),
              ),
              const SizedBox(width: 8),
              const Text('LOCAL SMPTE', style: TextStyle(color: AppColors.textSecondary, fontSize: 10, letterSpacing: 1.0)),
            ],
          ),
          session.isAllStopHeld
              ? ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  ),
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('RELEASE SAFETY HOLD', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                  onPressed: _releaseSafetyHold,
                )
              : ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade900,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    side: const BorderSide(color: Colors.redAccent),
                  ),
                  icon: const Icon(Icons.emergency, size: 16, color: Colors.white),
                  label: const Text('ALL-STOP', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                  onPressed: _engageSafetyAllStop,
                ),
        ],
      ),
    );
  }

  Widget _buildEmergencyHoldBanner(LiveOperationsSession session) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: Colors.red.shade900.withOpacity(0.9),
      child: Row(
        children: [
          const Icon(Icons.report_problem, color: Colors.white, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CRITICAL SAFETY HOLD ENGAGED - ALL CUES FROZEN',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                ),
                Text(
                  session.allStopReason ?? 'Safety inspection in progress.',
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveCueHero(LiveOperationsSession session) {
    final activeCue = session.cues.isNotEmpty && session.currentCueIndex < session.cues.length
        ? session.cues[session.currentCueIndex]
        : null;

    if (activeCue == null) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF1E2330),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(child: Text('No active cues scheduled', style: TextStyle(color: Colors.white))),
      );
    }

    final isCueActive = activeCue.executionStatus == 'ACTIVE';
    final isStandby = activeCue.executionStatus == 'STANDBY';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF1B202D),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCueActive
              ? Colors.greenAccent
              : isStandby
                  ? Colors.amberAccent
                  : AppColors.glassBorder,
          width: isCueActive ? 2.5 : 1.0,
        ),
        boxShadow: isCueActive
            ? [
                BoxShadow(
                  color: Colors.greenAccent.withOpacity(0.2),
                  blurRadius: 16,
                  spreadRadius: 2,
                )
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      activeCue.cueNumber,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getCueStatusColor(activeCue.executionStatus).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _getCueStatusColor(activeCue.executionStatus)),
                    ),
                    child: Text(
                      activeCue.executionStatus,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                        color: _getCueStatusColor(activeCue.executionStatus),
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                'Sched: ${activeCue.scheduledTime}',
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Text(
            activeCue.title,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),

          if (activeCue.actionSummary.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              activeCue.actionSummary,
              style: const TextStyle(fontSize: 13, color: Colors.white70),
            ),
          ],

          const SizedBox(height: 16),

          // Departmental Cues Grid
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF131722),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                _buildTechCueRow(Icons.volume_up, 'Audio Cue', activeCue.audioCue ?? 'Live mic balance'),
                const Divider(color: Color(0xFF282E3E), height: 12),
                _buildTechCueRow(Icons.lightbulb, 'Lighting Preset', activeCue.lightingCue ?? 'Standard state'),
                const Divider(color: Color(0xFF282E3E), height: 12),
                _buildTechCueRow(Icons.tv, 'Video Content', activeCue.videoCue ?? 'Main screen roll'),
                if (activeCue.contingencyAction != null) ...[
                  const Divider(color: Color(0xFF282E3E), height: 12),
                  _buildTechCueRow(Icons.healing, 'Contingency', activeCue.contingencyAction!, isWarning: true),
                ],
              ],
            ),
          ),

          const SizedBox(height: 18),

          // Tactical Stage Control Buttons
          Wrap(
            spacing: 10,
            runSpacing: 10,
            alignment: WrapAlignment.center,
            children: [
              // Standby Button
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.amberAccent,
                  side: const BorderSide(color: Colors.amberAccent, width: 1.5),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                icon: const Icon(Icons.pause_circle_outline, size: 18),
                label: const Text('STANDBY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                onPressed: () => _triggerCueAction(activeCue.cueNumber, 'STANDBY'),
              ),

              // Giant GO Button
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00E676),
                  foregroundColor: Colors.black,
                  elevation: 8,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.play_arrow, size: 24, color: Colors.black),
                label: const Text(
                  'GO',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, letterSpacing: 1.5),
                ),
                onPressed: () => _triggerCueAction(activeCue.cueNumber, 'GO'),
              ),

              // Complete Button
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2979FF),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                icon: const Icon(Icons.check, size: 18),
                label: const Text('COMPLETE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                onPressed: () => _triggerCueAction(activeCue.cueNumber, 'COMPLETE'),
              ),

              // Skip Button
              TextButton(
                style: TextButton.styleFrom(
                  foregroundColor: Colors.grey,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                onPressed: () => _triggerCueAction(activeCue.cueNumber, 'SKIP'),
                child: const Text('Skip Cue', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTechCueRow(IconData icon, String label, String value, {bool isWarning = false}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: isWarning ? Colors.orangeAccent : Colors.cyanAccent),
        const SizedBox(width: 8),
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              color: isWarning ? Colors.orangeAccent : Colors.white,
              fontWeight: isWarning ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStationTelemetrySection(LiveOperationsSession session) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'CREW STATION TELEMETRY',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.0, color: AppColors.textSecondary),
            ),
            Text(
              'Tap station to report issue',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: session.stations.values.map((station) {
              final color = _getStatusColor(station.status);
              final hasIssue = station.activeIssue != null && station.activeIssue!.isNotEmpty;

              return InkWell(
                onTap: () => _openStationTelemetryDialog(station),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  margin: const EdgeInsets.only(right: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B202D),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: hasIssue ? Colors.orangeAccent : AppColors.glassBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            station.stationName,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        station.operatorName,
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        station.status,
                        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildCueSheetSection(LiveOperationsSession session) {
    final cues = session.cues;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'TIMED RUN OF SHOW (${cues.length} CUES)',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.0, color: AppColors.textSecondary),
            ),
            Row(
              children: [
                _buildFilterChip('ALL'),
                const SizedBox(width: 6),
                _buildFilterChip('PENDING'),
                const SizedBox(width: 6),
                _buildFilterChip('COMPLETED'),
              ],
            ),
          ],
        ),
        const SizedBox(height: 12),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: cues.length,
          separatorBuilder: (context, index) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final cue = cues[index];
            final isCurrent = index == session.currentCueIndex;
            final isCompleted = cue.executionStatus == 'COMPLETED';

            if (_selectedFilter == 'PENDING' && isCompleted) return const SizedBox.shrink();
            if (_selectedFilter == 'COMPLETED' && !isCompleted) return const SizedBox.shrink();

            return Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isCurrent ? const Color(0xFF22293A) : const Color(0xFF161A24),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isCurrent
                      ? AppColors.primary
                      : isCompleted
                          ? Colors.white10
                          : AppColors.glassBorder,
                ),
              ),
              child: Row(
                children: [
                  // Cue Number Pill
                  Container(
                    width: 60,
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: isCurrent ? AppColors.primary.withOpacity(0.2) : Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      cue.cueNumber,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                        color: isCurrent ? AppColors.primary : Colors.white70,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Title & Operator
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cue.title,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                            color: isCompleted ? Colors.white54 : Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${cue.scheduledTime} • ${cue.operator ?? "Stage Crew"}',
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),

                  // Status Chip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _getCueStatusColor(cue.executionStatus).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      cue.executionStatus,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _getCueStatusColor(cue.executionStatus),
                      ),
                    ),
                  ),

                  const SizedBox(width: 8),

                  // Quick Action Menu
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 18, color: AppColors.textSecondary),
                    color: AppColors.surface,
                    onSelected: (action) => _triggerCueAction(cue.cueNumber, action),
                    itemBuilder: (ctx) => [
                      const PopupMenuItem(value: 'STANDBY', child: Text('Standby', style: TextStyle(color: Colors.amberAccent))),
                      const PopupMenuItem(value: 'GO', child: Text('Trigger GO', style: TextStyle(color: Colors.greenAccent))),
                      const PopupMenuItem(value: 'COMPLETE', child: Text('Mark Complete', style: TextStyle(color: Colors.blueAccent))),
                      const PopupMenuItem(value: 'SKIP', child: Text('Skip', style: TextStyle(color: Colors.grey))),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label) {
    final isSel = _selectedFilter == label;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: isSel ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: isSel ? AppColors.primary : AppColors.glassBorder),
        ),
        child: Text(
          label,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isSel ? Colors.black : AppColors.textSecondary),
        ),
      ),
    );
  }

  Color _getCueStatusColor(String status) {
    switch (status) {
      case 'ACTIVE':
        return Colors.greenAccent;
      case 'STANDBY':
        return Colors.amberAccent;
      case 'COMPLETED':
        return Colors.cyanAccent;
      case 'HOLD':
        return Colors.redAccent;
      case 'SKIPPED':
        return Colors.grey;
      case 'PENDING':
      default:
        return Colors.white54;
    }
  }
}
