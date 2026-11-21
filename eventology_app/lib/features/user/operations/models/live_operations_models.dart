class StationTelemetry {
  final String stationId;
  final String stationName;
  final String department;
  final String operatorName;
  final String status; // OFFLINE, CHECKED_IN, STANDBY, ACTION_REQUIRED, CRITICAL_ISSUE
  final String lastPingIso;
  final String? activeIssue;

  StationTelemetry({
    required this.stationId,
    required this.stationName,
    required this.department,
    required this.operatorName,
    required this.status,
    required this.lastPingIso,
    this.activeIssue,
  });

  factory StationTelemetry.fromJson(Map<String, dynamic> json) {
    return StationTelemetry(
      stationId: json['stationId'] as String? ?? '',
      stationName: json['stationName'] as String? ?? '',
      department: json['department'] as String? ?? '',
      operatorName: json['operatorName'] as String? ?? 'Operator',
      status: json['status'] as String? ?? 'CHECKED_IN',
      lastPingIso: json['lastPingIso'] as String? ?? '',
      activeIssue: json['activeIssue'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'stationId': stationId,
        'stationName': stationName,
        'department': department,
        'operatorName': operatorName,
        'status': status,
        'lastPingIso': lastPingIso,
        if (activeIssue != null) 'activeIssue': activeIssue,
      };
}

class LiveCueState {
  final String cueId;
  final String cueNumber;
  final String act;
  final String title;
  final String scheduledTime;
  final int durationSeconds;
  final String actionSummary;
  final String? audioCue;
  final String? lightingCue;
  final String? videoCue;
  final String? stageCue;
  final String? operator;
  final String? contingencyAction;
  final String executionStatus; // PENDING, STANDBY, ACTIVE, COMPLETED, HOLD, SKIPPED
  final String? standbyTimeIso;
  final String? goTimeIso;
  final String? completedTimeIso;
  final int? actualDurationSeconds;

  LiveCueState({
    required this.cueId,
    required this.cueNumber,
    required this.act,
    required this.title,
    required this.scheduledTime,
    required this.durationSeconds,
    required this.actionSummary,
    this.audioCue,
    this.lightingCue,
    this.videoCue,
    this.stageCue,
    this.operator,
    this.contingencyAction,
    required this.executionStatus,
    this.standbyTimeIso,
    this.goTimeIso,
    this.completedTimeIso,
    this.actualDurationSeconds,
  });

  factory LiveCueState.fromJson(Map<String, dynamic> json) {
    return LiveCueState(
      cueId: json['cueId'] as String? ?? '',
      cueNumber: json['cueNumber'] as String? ?? '',
      act: json['act'] as String? ?? 'act_1',
      title: json['title'] as String? ?? 'Untitled Cue',
      scheduledTime: json['scheduledTime'] as String? ?? '19:00:00',
      durationSeconds: json['durationSeconds'] as int? ?? 300,
      actionSummary: json['actionSummary'] as String? ?? '',
      audioCue: json['audioCue'] as String?,
      lightingCue: json['lightingCue'] as String?,
      videoCue: json['videoCue'] as String?,
      stageCue: json['stageCue'] as String?,
      operator: json['operator'] as String?,
      contingencyAction: json['contingencyAction'] as String?,
      executionStatus: json['executionStatus'] as String? ?? 'PENDING',
      standbyTimeIso: json['standbyTimeIso'] as String?,
      goTimeIso: json['goTimeIso'] as String?,
      completedTimeIso: json['completedTimeIso'] as String?,
      actualDurationSeconds: json['actualDurationSeconds'] as int?,
    );
  }

  LiveCueState copyWith({
    String? executionStatus,
    String? standbyTimeIso,
    String? goTimeIso,
    String? completedTimeIso,
    int? actualDurationSeconds,
  }) {
    return LiveCueState(
      cueId: cueId,
      cueNumber: cueNumber,
      act: act,
      title: title,
      scheduledTime: scheduledTime,
      durationSeconds: durationSeconds,
      actionSummary: actionSummary,
      audioCue: audioCue,
      lightingCue: lightingCue,
      videoCue: videoCue,
      stageCue: stageCue,
      operator: operator,
      contingencyAction: contingencyAction,
      executionStatus: executionStatus ?? this.executionStatus,
      standbyTimeIso: standbyTimeIso ?? this.standbyTimeIso,
      goTimeIso: goTimeIso ?? this.goTimeIso,
      completedTimeIso: completedTimeIso ?? this.completedTimeIso,
      actualDurationSeconds: actualDurationSeconds ?? this.actualDurationSeconds,
    );
  }
}

class LiveOperationsSession {
  final String sessionId;
  final String eventId;
  final String createdAtIso;
  final String updatedAtIso;
  final bool isAllStopHeld;
  final String? allStopReason;
  final String? allStopTriggeredBy;
  final int currentCueIndex;
  final String currentCueNumber;
  final List<LiveCueState> cues;
  final Map<String, StationTelemetry> stations;

  LiveOperationsSession({
    required this.sessionId,
    required this.eventId,
    required this.createdAtIso,
    required this.updatedAtIso,
    required this.isAllStopHeld,
    this.allStopReason,
    this.allStopTriggeredBy,
    required this.currentCueIndex,
    required this.currentCueNumber,
    required this.cues,
    required this.stations,
  });

  factory LiveOperationsSession.fromJson(Map<String, dynamic> json) {
    final cuesList = (json['cues'] as List<dynamic>? ?? [])
        .map((c) => LiveCueState.fromJson(c as Map<String, dynamic>))
        .toList();

    final rawStations = json['stations'] as Map<String, dynamic>? ?? {};
    final stationsMap = <String, StationTelemetry>{};
    rawStations.forEach((k, v) {
      if (v is Map<String, dynamic>) {
        stationsMap[k] = StationTelemetry.fromJson(v);
      }
    });

    return LiveOperationsSession(
      sessionId: json['sessionId'] as String? ?? '',
      eventId: json['eventId'] as String? ?? '',
      createdAtIso: json['createdAtIso'] as String? ?? '',
      updatedAtIso: json['updatedAtIso'] as String? ?? '',
      isAllStopHeld: json['isAllStopHeld'] == true,
      allStopReason: json['allStopReason'] as String?,
      allStopTriggeredBy: json['allStopTriggeredBy'] as String?,
      currentCueIndex: json['currentCueIndex'] as int? ?? 0,
      currentCueNumber: json['currentCueNumber'] as String? ?? '',
      cues: cuesList,
      stations: stationsMap,
    );
  }

  LiveOperationsSession copyWith({
    bool? isAllStopHeld,
    String? allStopReason,
    String? allStopTriggeredBy,
    int? currentCueIndex,
    String? currentCueNumber,
    List<LiveCueState>? cues,
    Map<String, StationTelemetry>? stations,
    String? updatedAtIso,
  }) {
    return LiveOperationsSession(
      sessionId: sessionId,
      eventId: eventId,
      createdAtIso: createdAtIso,
      updatedAtIso: updatedAtIso ?? DateTime.now().toIso8601String(),
      isAllStopHeld: isAllStopHeld ?? this.isAllStopHeld,
      allStopReason: allStopReason ?? this.allStopReason,
      allStopTriggeredBy: allStopTriggeredBy ?? this.allStopTriggeredBy,
      currentCueIndex: currentCueIndex ?? this.currentCueIndex,
      currentCueNumber: currentCueNumber ?? this.currentCueNumber,
      cues: cues ?? this.cues,
      stations: stations ?? this.stations,
    );
  }
}

