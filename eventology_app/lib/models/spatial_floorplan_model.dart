import 'dart:math' as math;
import 'production_artifact_model.dart';

/// Represents a 2D point in room meters anchored at Top-Left (0,0).
class FloorplanPoint {
  final double x;
  final double y;

  const FloorplanPoint(this.x, this.y);

  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  factory FloorplanPoint.fromJson(Map<String, dynamic> json) {
    return FloorplanPoint(
      (json['x'] as num?)?.toDouble() ?? 0.0,
      (json['y'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// Represents a 2D rectangular entity in room meters.
class FloorplanRect {
  final double x;
  final double y;
  final double width;
  final double height;
  final String? label;

  const FloorplanRect({
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    this.label,
  });

  bool contains(double px, double py) {
    return px >= x && px <= x + width && py >= y && py <= y + height;
  }

  Map<String, dynamic> toJson() => {
        'x': x,
        'y': y,
        'width': width,
        'height': height,
        if (label != null) 'label': label,
      };

  factory FloorplanRect.fromJson(Map<String, dynamic> json) {
    return FloorplanRect(
      x: (json['x'] as num?)?.toDouble() ?? 0.0,
      y: (json['y'] as num?)?.toDouble() ?? 0.0,
      width: (json['width'] as num?)?.toDouble() ?? 0.0,
      height: (json['height'] as num?)?.toDouble() ?? 0.0,
      label: json['label'] as String?,
    );
  }
}

/// NBC 2016 Compliant or Substandard Exit Doorway representation.
class FloorplanExit {
  final String doorId;
  final String label;
  final String wall; // north, south, east, west
  final FloorplanPoint startPoint;
  final FloorplanPoint endPoint;
  final double clearWidthM;
  final bool isSubstandard; // clearWidthM < 2.0m for assembly occupancy
  final String swingDirection;

  const FloorplanExit({
    required this.doorId,
    required this.label,
    required this.wall,
    required this.startPoint,
    required this.endPoint,
    required this.clearWidthM,
    required this.isSubstandard,
    this.swingDirection = 'outward',
  });

  factory FloorplanExit.fromJson(Map<String, dynamic> json) {
    return FloorplanExit(
      doorId: json['doorId'] as String? ?? 'door-unknown',
      label: json['label'] as String? ?? 'Exit Door',
      wall: json['wall'] as String? ?? 'south',
      startPoint: FloorplanPoint.fromJson(json['startPoint'] as Map<String, dynamic>? ?? {}),
      endPoint: FloorplanPoint.fromJson(json['endPoint'] as Map<String, dynamic>? ?? {}),
      clearWidthM: (json['clearWidthM'] as num?)?.toDouble() ?? 1.5,
      isSubstandard: json['isSubstandard'] as bool? ?? false,
      swingDirection: json['swingDirection'] as String? ?? 'outward',
    );
  }
}

/// Stage platform and ADA / NBC 2016 wheelchair access ramp footprint.
class FloorplanStage {
  final FloorplanRect boundary;
  final FloorplanRect clearanceBuffer;
  final double heightM;
  final double rampLengthM;
  final double rampSlopeRatio; // 1:12 = 0.0833
  final int rampLandingsCount;
  final FloorplanRect? rampBoundary;

  const FloorplanStage({
    required this.boundary,
    required this.clearanceBuffer,
    this.heightM = 0.8,
    this.rampLengthM = 9.6,
    this.rampSlopeRatio = 12.0, // 1:12
    this.rampLandingsCount = 2,
    this.rampBoundary,
  });
}

/// Designated Wheelchair Bay & Companion Seat (Universal ADA / NBC Compliance).
class FloorplanWheelchairBay {
  final String bayId;
  final FloorplanRect rect;
  final bool hasCompanionSeat;
  final String label;

  const FloorplanWheelchairBay({
    required this.bayId,
    required this.rect,
    this.hasCompanionSeat = true,
    required this.label,
  });
}

/// Equipment, FOH console, or Rigging zone.
class FloorplanEquipmentZone {
  final String id;
  final String name;
  final String type; // foh_console, rigging_truss, power_distro, video_wall
  final FloorplanRect boundary;

  const FloorplanEquipmentZone({
    required this.id,
    required this.name,
    required this.type,
    required this.boundary,
  });
}

/// Candidate egress travel route vector with NBC travel distance evaluation.
class FloorplanEgressRoute {
  final String routeId;
  final String label;
  final String fromZone;
  final String toDoorId;
  final List<FloorplanPoint> waypoints;
  final double totalTravelDistanceM;
  final double maxPermissibleTravelDistanceM;
  final bool exceedsTravelDistanceLimit;

  const FloorplanEgressRoute({
    required this.routeId,
    required this.label,
    required this.fromZone,
    required this.toDoorId,
    required this.waypoints,
    required this.totalTravelDistanceM,
    this.maxPermissibleTravelDistanceM = 30.0,
    required this.exceedsTravelDistanceLimit,
  });
}

/// Complete parsed 2D technical floorplan model for interactive rendering.
class TechnicalFloorplanModel {
  final String venueName;
  final String? venueId;
  final String workflowId;
  final double roomLengthM; // X axis
  final double roomWidthM;  // Y axis
  final double calculatedAreaM2;
  final int doorsCount;
  final int substandardDoorsCount;
  final String lifeSafetyStatus;
  final bool preliminaryScreeningPassed;
  final List<String> screeningFlags;

  final FloorplanStage? stage;
  final List<FloorplanWheelchairBay> wheelchairBays;
  final List<FloorplanExit> exits;
  final List<FloorplanEquipmentZone> equipmentZones;
  final List<FloorplanEgressRoute> egressRoutes;
  final FloorplanRect? seatingBlock;

  const TechnicalFloorplanModel({
    required this.venueName,
    this.venueId,
    required this.workflowId,
    required this.roomLengthM,
    required this.roomWidthM,
    required this.calculatedAreaM2,
    required this.doorsCount,
    required this.substandardDoorsCount,
    required this.lifeSafetyStatus,
    required this.preliminaryScreeningPassed,
    this.screeningFlags = const [],
    this.stage,
    this.wheelchairBays = const [],
    this.exits = const [],
    this.equipmentZones = const [],
    this.egressRoutes = const [],
    this.seatingBlock,
  });

  /// Factory synthesizing the model from ProductionArtifact metadata and SVG content.
  factory TechnicalFloorplanModel.fromArtifact(ProductionArtifact artifact) {
    final meta = artifact.metadata;

    final roomLen = (meta['roomLengthM'] as num?)?.toDouble() ?? 30.0;
    final roomWid = (meta['roomWidthM'] as num?)?.toDouble() ?? 20.0;
    final area = (meta['calculatedAreaM2'] as num?)?.toDouble() ?? (roomLen * roomWid);
    final venueName = meta['venueName'] as String? ?? 'Technical Venue';
    final venueId = meta['evaluatedVenueId'] as String?;
    final workflowId = meta['workflowId'] as String? ?? 'wf-preview';
    final dCount = (meta['doorsCount'] as num?)?.toInt() ?? 2;
    final subCount = (meta['substandardDoorsCount'] as num?)?.toInt() ?? 0;
    final lsStatus = meta['lifeSafetyStatus'] as String? ?? 'preliminary';
    final passed = meta['preliminaryScreeningPassed'] as bool? ?? true;

    final flags = (meta['screeningFlags'] as List?)
            ?.map((e) => e.toString())
            .toList() ??
        <String>[];

    // Synthesize stage platform & 1:12 slope ramp
    final stageW = math.min(roomLen * 0.5, 14.0);
    final stageD = math.min(roomWid * 0.25, 6.0);
    final stageX = (roomLen - stageW) / 2.0;
    const stageY = 1.5;
    const stageHeight = 0.8;
    const rampLength = stageHeight * 12.0; // 9.6m
    const rampWidth = 1.5;

    final stage = FloorplanStage(
      boundary: FloorplanRect(
        x: stageX,
        y: stageY,
        width: stageW,
        height: stageD,
        label: 'Main Presentation Stage ($stageW m × $stageD m)',
      ),
      clearanceBuffer: FloorplanRect(
        x: stageX,
        y: stageY + stageD,
        width: stageW,
        height: 1.5,
        label: 'Front Stage Clearance Buffer (1.5m)',
      ),
      heightM: stageHeight,
      rampLengthM: rampLength,
      rampSlopeRatio: 12.0,
      rampLandingsCount: 2,
      rampBoundary: FloorplanRect(
        x: math.max(0.5, stageX - rampWidth - 0.5),
        y: stageY,
        width: rampWidth,
        height: math.min(stageD + 2.0, rampLength * 0.6),
        label: 'ADA/NBC 1:12 Accessible Ramp',
      ),
    );

    // Synthesize designated wheelchair seating bays
    final wheelchairBays = <FloorplanWheelchairBay>[];
    const bayDim = 1.5; // 1.5m x 1.5m turning radius
    final bayStartY = stageY + stageD + 3.0;

    for (int i = 0; i < 4; i++) {
      wheelchairBays.add(
        FloorplanWheelchairBay(
          bayId: 'wb-${i + 1}',
          rect: FloorplanRect(
            x: 2.0 + (i * 2.5),
            y: bayStartY,
            width: bayDim,
            height: bayDim,
            label: 'Wheelchair Bay #${i + 1} ($bayDim m × $bayDim m)',
          ),
          label: 'Wheelchair Space #${i + 1} + Companion',
        ),
      );
    }

    // Synthesize exit doorways along perimeter walls
    final exits = <FloorplanExit>[];
    if (dCount >= 1) {
      exits.add(
        FloorplanExit(
          doorId: 'exit-south-main',
          label: 'South Main Exit (2.4m NBC Assembly Compliant)',
          wall: 'south',
          startPoint: FloorplanPoint((roomLen / 2) - 1.2, roomWid),
          endPoint: FloorplanPoint((roomLen / 2) + 1.2, roomWid),
          clearWidthM: 2.4,
          isSubstandard: false,
          swingDirection: 'outward',
        ),
      );
    }
    if (dCount >= 2) {
      exits.add(
        FloorplanExit(
          doorId: 'exit-east-service',
          label: subCount > 0
              ? 'East Egress Door (1.2m Substandard Assembly Width)'
              : 'East Egress Door (2.0m NBC Compliant)',
          wall: 'east',
          startPoint: FloorplanPoint(roomLen, roomWid * 0.4),
          endPoint: FloorplanPoint(roomLen, (roomWid * 0.4) + (subCount > 0 ? 1.2 : 2.0)),
          clearWidthM: subCount > 0 ? 1.2 : 2.0,
          isSubstandard: subCount > 0,
          swingDirection: 'outward',
        ),
      );
    }
    if (dCount >= 3) {
      exits.add(
        FloorplanExit(
          doorId: 'exit-west-service',
          label: 'West Egress Door (2.0m NBC Compliant)',
          wall: 'west',
          startPoint: FloorplanPoint(0.0, roomWid * 0.4),
          endPoint: FloorplanPoint(0.0, (roomWid * 0.4) + 2.0),
          clearWidthM: 2.0,
          isSubstandard: false,
          swingDirection: 'outward',
        ),
      );
    }

    // Synthesize equipment zones
    final equipmentZones = <FloorplanEquipmentZone>[
      FloorplanEquipmentZone(
        id: 'eq-foh',
        name: 'FOH Audio/Lighting Console ($roomLen/2)',
        type: 'foh_console',
        boundary: FloorplanRect(
          x: (roomLen / 2) - 2.5,
          y: roomWid - 5.5,
          width: 5.0,
          height: 2.5,
          label: 'FOH Mix & Production Control',
        ),
      ),
      FloorplanEquipmentZone(
        id: 'eq-power',
        name: 'Main Stage Camlock Power Drop',
        type: 'power_distribution',
        boundary: FloorplanRect(
          x: 1.0,
          y: 1.5,
          width: 2.0,
          height: 2.0,
          label: '125A 3-Phase Camlock Feeder',
        ),
      ),
    ];

    // Synthesize candidate egress routes
    final egressRoutes = <FloorplanEgressRoute>[
      FloorplanEgressRoute(
        routeId: 'route-foh-south',
        label: 'FOH Center to Main South Exit (Direct)',
        fromZone: 'FOH Console',
        toDoorId: 'exit-south-main',
        waypoints: [
          FloorplanPoint(roomLen / 2, roomWid - 3.0),
          FloorplanPoint(roomLen / 2, roomWid),
        ],
        totalTravelDistanceM: 3.0,
        maxPermissibleTravelDistanceM: 30.0,
        exceedsTravelDistanceLimit: false,
      ),
      FloorplanEgressRoute(
        routeId: 'route-stage-east',
        label: 'Stage Left Perimeter to East Exit',
        fromZone: 'Stage Left',
        toDoorId: 'exit-east-service',
        waypoints: [
          FloorplanPoint(stageX + stageW, stageY + stageD / 2),
          FloorplanPoint(roomLen - 1.5, stageY + stageD / 2),
          FloorplanPoint(roomLen, roomWid * 0.4 + 1.0),
        ],
        totalTravelDistanceM: (roomLen - (stageX + stageW)) + (roomWid * 0.4),
        maxPermissibleTravelDistanceM: 30.0,
        exceedsTravelDistanceLimit: false,
      ),
    ];

    final seatingBlock = FloorplanRect(
      x: 3.0,
      y: bayStartY + bayDim + 1.5,
      width: roomLen - 6.0,
      height: math.max(4.0, (roomWid - 5.5) - (bayStartY + bayDim + 2.5)),
      label: 'Main Audience Seating & Circulation Grid',
    );

    return TechnicalFloorplanModel(
      venueName: venueName,
      venueId: venueId,
      workflowId: workflowId,
      roomLengthM: roomLen,
      roomWidthM: roomWid,
      calculatedAreaM2: area,
      doorsCount: dCount,
      substandardDoorsCount: subCount,
      lifeSafetyStatus: lsStatus,
      preliminaryScreeningPassed: passed,
      screeningFlags: flags,
      stage: stage,
      wheelchairBays: wheelchairBays,
      exits: exits,
      equipmentZones: equipmentZones,
      egressRoutes: egressRoutes,
      seatingBlock: seatingBlock,
    );
  }
}
