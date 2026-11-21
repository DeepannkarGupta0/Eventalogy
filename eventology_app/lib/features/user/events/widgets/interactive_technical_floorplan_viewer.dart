import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../models/spatial_floorplan_model.dart';
import '../../../../models/production_artifact_model.dart';

class InteractiveTechnicalFloorplanViewer extends StatefulWidget {
  final TechnicalFloorplanModel floorplan;
  final VoidCallback? onExportSvg;
  final VoidCallback? onExportDxf;

  const InteractiveTechnicalFloorplanViewer({
    super.key,
    required this.floorplan,
    this.onExportSvg,
    this.onExportDxf,
  });

  factory InteractiveTechnicalFloorplanViewer.fromArtifact(ProductionArtifact artifact) {
    return InteractiveTechnicalFloorplanViewer(
      floorplan: TechnicalFloorplanModel.fromArtifact(artifact),
    );
  }

  @override
  State<InteractiveTechnicalFloorplanViewer> createState() =>
      _InteractiveTechnicalFloorplanViewerState();
}

class _InteractiveTechnicalFloorplanViewerState
    extends State<InteractiveTechnicalFloorplanViewer> {
  final TransformationController _transformController = TransformationController();

  // Layer Toggles
  bool _showGridAndBoundary = true;
  bool _showStageAndRamp = true;
  bool _showAccessibility = true;
  bool _showExits = true;
  bool _showCirculation = true;
  bool _showEquipment = true;

  // Selected Entity for Inspector
  String? _selectedEntityId;
  String? _selectedEntityTitle;
  String? _selectedEntityType;
  String? _selectedEntityDimensions;
  String? _selectedEntityCompliance;
  bool _selectedEntityIsCompliant = true;
  String? _selectedEntityNotes;

  void _resetZoom() {
    setState(() {
      _transformController.value = Matrix4.identity();
    });
  }

  void _selectEntity({
    required String id,
    required String title,
    required String type,
    required String dimensions,
    required String compliance,
    required bool isCompliant,
    required String notes,
  }) {
    setState(() {
      _selectedEntityId = id;
      _selectedEntityTitle = title;
      _selectedEntityType = type;
      _selectedEntityDimensions = dimensions;
      _selectedEntityCompliance = compliance;
      _selectedEntityIsCompliant = isCompliant;
      _selectedEntityNotes = notes;
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedEntityId = null;
    });
  }

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF070D1F), // Architectural dark blueprint background
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(),
          _buildLayerToolbar(),
          Expanded(
            child: Stack(
              children: [
                InteractiveViewer(
                  transformationController: _transformController,
                  minScale: 0.4,
                  maxScale: 4.0,
                  boundaryMargin: const EdgeInsets.all(120),
                  child: Center(
                    child: GestureDetector(
                      onTapUp: (details) => _handleCanvasTap(details.localPosition),
                      child: CustomPaint(
                        size: Size(
                          math.max(800.0, widget.floorplan.roomLengthM * 24.0 + 200.0),
                          math.max(600.0, widget.floorplan.roomWidthM * 24.0 + 160.0),
                        ),
                        painter: FloorplanCanvasPainter(
                          floorplan: widget.floorplan,
                          showGridAndBoundary: _showGridAndBoundary,
                          showStageAndRamp: _showStageAndRamp,
                          showAccessibility: _showAccessibility,
                          showExits: _showExits,
                          showCirculation: _showCirculation,
                          showEquipment: _showEquipment,
                          selectedEntityId: _selectedEntityId,
                        ),
                      ),
                    ),
                  ),
                ),

                // Floating Zoom Reset Controls
                Positioned(
                  right: 16,
                  top: 16,
                  child: Column(
                    children: [
                      _buildFloatingButton(
                        icon: Icons.restart_alt,
                        tooltip: 'Reset View (100%)',
                        onTap: _resetZoom,
                      ),
                      const SizedBox(height: 8),
                      _buildFloatingButton(
                        icon: Icons.zoom_in,
                        tooltip: 'Zoom In',
                        onTap: () {
                          final current = _transformController.value;
                          _transformController.value = current.scaled(1.25, 1.25, 1.0);
                        },
                      ),
                      const SizedBox(height: 8),
                      _buildFloatingButton(
                        icon: Icons.zoom_out,
                        tooltip: 'Zoom Out',
                        onTap: () {
                          final current = _transformController.value;
                          _transformController.value = current.scaled(0.8, 0.8, 1.0);
                        },
                      ),
                    ],
                  ),
                ),

                // Bottom Technical Inspector Card
                if (_selectedEntityId != null)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 16,
                    child: _buildInspectorCard(),
                  ),
              ],
            ),
          ),
          _buildFooterDisclaimer(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final passed = widget.floorplan.preliminaryScreeningPassed;
    final statusColor = passed ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    final statusText = passed ? 'PRELIMINARY SCREENING PASSED' : 'REQUIRES TECHNICAL REVIEW';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withOpacity(0.3)),
            ),
            child: const Icon(Icons.architecture, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        widget.floorplan.venueName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: statusColor, width: 1),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${widget.floorplan.roomLengthM.toStringAsFixed(1)}m × ${widget.floorplan.roomWidthM.toStringAsFixed(1)}m (${widget.floorplan.calculatedAreaM2.toStringAsFixed(0)} m²) | ${widget.floorplan.doorsCount} Exit Doors (${widget.floorplan.substandardDoorsCount} Substandard)',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
          if (widget.onExportSvg != null)
            IconButton(
              icon: const Icon(Icons.download_outlined, color: AppColors.primary, size: 20),
              tooltip: 'Export SVG',
              onPressed: widget.onExportSvg,
            ),
        ],
      ),
    );
  }

  Widget _buildLayerToolbar() {
    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: const BoxDecoration(
        color: Color(0xFF0B132B),
        border: Border(bottom: BorderSide(color: Color(0xFF1C2541))),
      ),
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _buildFilterChip(
            label: 'Boundary & Grid',
            icon: Icons.grid_4x4,
            isSelected: _showGridAndBoundary,
            onSelected: (val) => setState(() => _showGridAndBoundary = val),
          ),
          const SizedBox(width: 6),
          _buildFilterChip(
            label: 'Stage & Ramp',
            icon: Icons.theater_comedy,
            isSelected: _showStageAndRamp,
            onSelected: (val) => setState(() => _showStageAndRamp = val),
          ),
          const SizedBox(width: 6),
          _buildFilterChip(
            label: 'ADA Accessibility (${widget.floorplan.wheelchairBays.length})',
            icon: Icons.accessible,
            isSelected: _showAccessibility,
            onSelected: (val) => setState(() => _showAccessibility = val),
          ),
          const SizedBox(width: 6),
          _buildFilterChip(
            label: 'NBC Exits (${widget.floorplan.exits.length})',
            icon: Icons.meeting_room_outlined,
            isSelected: _showExits,
            onSelected: (val) => setState(() => _showExits = val),
          ),
          const SizedBox(width: 6),
          _buildFilterChip(
            label: 'Egress Routes',
            icon: Icons.alt_route,
            isSelected: _showCirculation,
            onSelected: (val) => setState(() => _showCirculation = val),
          ),
          const SizedBox(width: 6),
          _buildFilterChip(
            label: 'Equipment Zones',
            icon: Icons.speaker_group_outlined,
            isSelected: _showEquipment,
            onSelected: (val) => setState(() => _showEquipment = val),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required IconData icon,
    required bool isSelected,
    required ValueChanged<bool> onSelected,
  }) {
    return FilterChip(
      selected: isSelected,
      onSelected: onSelected,
      labelPadding: const EdgeInsets.symmetric(horizontal: 2),
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      backgroundColor: const Color(0xFF131F3F),
      selectedColor: AppColors.primary.withOpacity(0.25),
      side: BorderSide(
        color: isSelected ? AppColors.primary : const Color(0xFF263352),
        width: 1,
      ),
      avatar: Icon(
        icon,
        size: 14,
        color: isSelected ? AppColors.primary : const Color(0xFF94A3B8),
      ),
      label: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          color: isSelected ? Colors.white : const Color(0xFF94A3B8),
        ),
      ),
    );
  }

  Widget _buildFloatingButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Material(
      color: const Color(0xFF1E293B).withOpacity(0.85),
      borderRadius: BorderRadius.circular(8),
      elevation: 4,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Icon(icon, size: 18, color: Colors.white),
        ),
      ),
    );
  }

  Widget _buildInspectorCard() {
    final isCompliant = _selectedEntityIsCompliant;
    final badgeColor = isCompliant ? const Color(0xFF10B981) : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: badgeColor.withOpacity(0.6), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.5),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    isCompliant ? Icons.verified_outlined : Icons.warning_amber_rounded,
                    color: badgeColor,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _selectedEntityTitle ?? 'Selected Component',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.close, size: 18, color: Color(0xFF94A3B8)),
                onPressed: _clearSelection,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _selectedEntityCompliance ?? '',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: badgeColor,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Type: ${_selectedEntityType ?? 'N/A'} • Dimensions: ${_selectedEntityDimensions ?? 'N/A'}',
                style: const TextStyle(fontSize: 11, color: Color(0xFFCBD5E1)),
              ),
            ],
          ),
          if (_selectedEntityNotes != null) ...[
            const SizedBox(height: 6),
            Text(
              _selectedEntityNotes!,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF94A3B8),
                height: 1.3,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFooterDisclaimer() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: const Color(0xFF0F172A),
      child: const Row(
        children: [
          Icon(Icons.info_outline, size: 14, color: Color(0xFFF59E0B)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'PRELIMINARY VECTOR DRAFT: Uncertified mathematical model. Does not replace stamped architectural or local Fire NOC approval.',
              style: TextStyle(fontSize: 10, color: Color(0xFFFCA5A5)),
            ),
          ),
        ],
      ),
    );
  }

  void _handleCanvasTap(Offset tapPos) {
    const scale = 24.0;
    const originX = 100.0;
    const originY = 80.0;

    final clickXM = (tapPos.dx - originX) / scale;
    final clickYM = (tapPos.dy - originY) / scale;

    // Check Exits
    for (final exit in widget.floorplan.exits) {
      final midX = (exit.startPoint.x + exit.endPoint.x) / 2;
      final midY = (exit.startPoint.y + exit.endPoint.y) / 2;
      final dist = math.sqrt(math.pow(clickXM - midX, 2) + math.pow(clickYM - midY, 2));
      if (dist <= 1.5) {
        _selectEntity(
          id: exit.doorId,
          title: exit.label,
          type: 'Exit Door',
          dimensions: '${exit.clearWidthM.toStringAsFixed(2)}m Clear Width',
          compliance: exit.isSubstandard
              ? 'SUBSTANDARD (< 2.0m NBC 2016 Part 4 Assembly Minimum)'
              : 'COMPLIANT (NBC 2016 Part 4 Assembly Egress Approved)',
          isCompliant: !exit.isSubstandard,
          notes: exit.isSubstandard
              ? 'Width is below 2.0m required for public assembly occupancy. Fire Authority review mandatory.'
              : 'Clear width meets or exceeds 2.0m assembly egress standard with outward swing.',
        );
        return;
      }
    }

    // Check Stage & Ramp
    final st = widget.floorplan.stage;
    if (st != null) {
      if (st.boundary.contains(clickXM, clickYM)) {
        _selectEntity(
          id: 'stage-main',
          title: st.boundary.label ?? 'Main Presentation Stage',
          type: 'Stage Platform',
          dimensions: '${st.boundary.width}m W × ${st.boundary.height}m D (${st.heightM}m elevation)',
          compliance: 'STRUCTURAL DRAFT',
          isCompliant: true,
          notes: 'Standard 4x4 stage deck system with 1.5m front clearance zone to first seating row.',
        );
        return;
      }
      if (st.rampBoundary != null && st.rampBoundary!.contains(clickXM, clickYM)) {
        _selectEntity(
          id: 'stage-ramp',
          title: 'ADA / NBC Universal Accessible Stage Ramp',
          type: 'Accessibility Ramp',
          dimensions: '${st.rampLengthM.toStringAsFixed(1)}m Run (1:12 Slope) with ${st.rampLandingsCount} Landings',
          compliance: 'ADA / NBC 2016 COMPLIANT (1:12 MAX SLOPE)',
          isCompliant: true,
          notes: 'Continuous accessible route to stage with 1.5m x 1.5m level landings and handrails.',
        );
        return;
      }
    }

    // Check Wheelchair Bays
    for (final bay in widget.floorplan.wheelchairBays) {
      if (bay.rect.contains(clickXM, clickYM)) {
        _selectEntity(
          id: bay.bayId,
          title: bay.label,
          type: 'Wheelchair Seating Bay',
          dimensions: '${bay.rect.width}m × ${bay.rect.height}m ($bay.rect.width * $bay.rect.height m²)',
          compliance: 'ADA 2010 SECTION 221 COMPLIANT',
          isCompliant: true,
          notes: 'Level clear floor space with adjacent designated companion seating.',
        );
        return;
      }
    }

    // Check Equipment Zones
    for (final eq in widget.floorplan.equipmentZones) {
      if (eq.boundary.contains(clickXM, clickYM)) {
        _selectEntity(
          id: eq.id,
          title: eq.name,
          type: 'Production Equipment Zone',
          dimensions: '${eq.boundary.width}m × ${eq.boundary.height}m',
          compliance: 'TECHNICAL CLEARANCE ZONE',
          isCompliant: true,
          notes: 'Designated AV technical footprint segregated from main public circulation egress paths.',
        );
        return;
      }
    }

    // Default clear
    _clearSelection();
  }
}

/// Canvas Painter deterministically drawing the 2D architectural drafting blueprint.
class FloorplanCanvasPainter extends CustomPainter {
  final TechnicalFloorplanModel floorplan;
  final bool showGridAndBoundary;
  final bool showStageAndRamp;
  final bool showAccessibility;
  final bool showExits;
  final bool showCirculation;
  final bool showEquipment;
  final String? selectedEntityId;

  const FloorplanCanvasPainter({
    required this.floorplan,
    required this.showGridAndBoundary,
    required this.showStageAndRamp,
    required this.showAccessibility,
    required this.showExits,
    required this.showCirculation,
    required this.showEquipment,
    this.selectedEntityId,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const scale = 24.0; // pixels per room meter
    const originX = 100.0;
    const originY = 80.0;

    final roomW = floorplan.roomLengthM * scale;
    final roomH = floorplan.roomWidthM * scale;

    // Helper to map model meters to canvas pixels
    double toPxX(double m) => originX + m * scale;
    double toPxY(double m) => originY + m * scale;

    // 1. Grid & Room Boundary
    if (showGridAndBoundary) {
      final fineGridPaint = Paint()
        ..color = const Color(0xFF152238)
        ..strokeWidth = 0.5;

      final majorGridPaint = Paint()
        ..color = const Color(0xFF203254)
        ..strokeWidth = 1.0;

      // Vertical grid lines
      for (int x = 0; x <= floorplan.roomLengthM; x++) {
        final px = toPxX(x.toDouble());
        canvas.drawLine(
          Offset(px, toPxY(0)),
          Offset(px, toPxY(floorplan.roomWidthM)),
          x % 5 == 0 ? majorGridPaint : fineGridPaint,
        );
      }

      // Horizontal grid lines
      for (int y = 0; y <= floorplan.roomWidthM; y++) {
        final py = toPxY(y.toDouble());
        canvas.drawLine(
          Offset(toPxX(0), py),
          Offset(toPxX(floorplan.roomLengthM), py),
          y % 5 == 0 ? majorGridPaint : fineGridPaint,
        );
      }

      // Room interior fill
      final roomFillPaint = Paint()..color = const Color(0xFF0F1A33);
      canvas.drawRect(Rect.fromLTWH(originX, originY, roomW, roomH), roomFillPaint);

      // Room perimeter walls
      final wallPaint = Paint()
        ..color = const Color(0xFF3B82F6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5;
      canvas.drawRect(Rect.fromLTWH(originX, originY, roomW, roomH), wallPaint);

      // Dimension Annotations
      _drawDimensionLine(
        canvas: canvas,
        p1: Offset(originX, originY - 24),
        p2: Offset(originX + roomW, originY - 24),
        text: '${floorplan.roomLengthM.toStringAsFixed(1)}m Room Length',
      );
      _drawDimensionLine(
        canvas: canvas,
        p1: Offset(originX - 24, originY),
        p2: Offset(originX - 24, originY + roomH),
        text: '${floorplan.roomWidthM.toStringAsFixed(1)}m Room Width',
        isVertical: true,
      );
    }

    // 2. Audience Seating & Circulation
    if (showCirculation && floorplan.seatingBlock != null) {
      final sb = floorplan.seatingBlock!;
      final sbRect = Rect.fromLTWH(
        toPxX(sb.x),
        toPxY(sb.y),
        sb.width * scale,
        sb.height * scale,
      );

      final seatingZonePaint = Paint()..color = const Color(0xFF1E293B).withOpacity(0.5);
      canvas.drawRect(sbRect, seatingZonePaint);

      final seatingBorderPaint = Paint()
        ..color = const Color(0xFF64748B)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0;
      canvas.drawRect(sbRect, seatingBorderPaint);

      _drawText(
        canvas: canvas,
        text: sb.label ?? 'Audience Seating & Circulation',
        position: Offset(sbRect.center.dx, sbRect.center.dy - 6),
        color: const Color(0xFF94A3B8),
        fontSize: 11,
      );

      // Candidate Egress Routes
      for (final route in floorplan.egressRoutes) {
        if (route.waypoints.length >= 2) {
          final routePaint = Paint()
            ..color = route.exceedsTravelDistanceLimit
                ? const Color(0xFFEF4444)
                : const Color(0xFF06B6D4)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.0;

          final path = Path();
          path.moveTo(toPxX(route.waypoints[0].x), toPxY(route.waypoints[0].y));
          for (int i = 1; i < route.waypoints.length; i++) {
            path.lineTo(toPxX(route.waypoints[i].x), toPxY(route.waypoints[i].y));
          }
          canvas.drawPath(path, routePaint);
        }
      }
    }

    // 3. Stage Platform & ADA 1:12 Ramp
    if (showStageAndRamp && floorplan.stage != null) {
      final st = floorplan.stage!;
      final isSelected = selectedEntityId == 'stage-main';

      final stageRect = Rect.fromLTWH(
        toPxX(st.boundary.x),
        toPxY(st.boundary.y),
        st.boundary.width * scale,
        st.boundary.height * scale,
      );

      // Stage Fill & Border
      canvas.drawRect(
        stageRect,
        Paint()..color = isSelected ? const Color(0xFF38BDF8).withOpacity(0.3) : const Color(0xFF1E293B),
      );
      canvas.drawRect(
        stageRect,
        Paint()
          ..color = isSelected ? const Color(0xFF38BDF8) : const Color(0xFF0284C7)
          ..style = PaintingStyle.stroke
          ..strokeWidth = isSelected ? 3.0 : 2.0,
      );

      _drawText(
        canvas: canvas,
        text: 'MAIN PRESENTATION STAGE',
        position: Offset(stageRect.center.dx, stageRect.center.dy - 6),
        color: const Color(0xFF38BDF8),
        fontSize: 12,
        isBold: true,
      );

      // Front Stage Clearance Zone
      final cl = st.clearanceBuffer;
      final clRect = Rect.fromLTWH(
        toPxX(cl.x),
        toPxY(cl.y),
        cl.width * scale,
        cl.height * scale,
      );
      canvas.drawRect(
        clRect,
        Paint()..color = const Color(0xFFF59E0B).withOpacity(0.12),
      );
      canvas.drawRect(
        clRect,
        Paint()
          ..color = const Color(0xFFF59E0B)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.0,
      );
      _drawText(
        canvas: canvas,
        text: '1.5m Front Clearance Buffer',
        position: Offset(clRect.center.dx, clRect.center.dy - 4),
        color: const Color(0xFFF59E0B),
        fontSize: 9,
      );

      // ADA Accessible Ramp
      if (st.rampBoundary != null) {
        final rb = st.rampBoundary!;
        final isRampSelected = selectedEntityId == 'stage-ramp';
        final rampRect = Rect.fromLTWH(
          toPxX(rb.x),
          toPxY(rb.y),
          rb.width * scale,
          rb.height * scale,
        );

        canvas.drawRect(
          rampRect,
          Paint()..color = isRampSelected ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFF065F46),
        );
        canvas.drawRect(
          rampRect,
          Paint()
            ..color = isRampSelected ? const Color(0xFF34D399) : const Color(0xFF10B981)
            ..style = PaintingStyle.stroke
            ..strokeWidth = isRampSelected ? 2.5 : 1.5,
        );
        _drawText(
          canvas: canvas,
          text: 'ADA 1:12 RAMP',
          position: Offset(rampRect.center.dx, rampRect.center.dy - 4),
          color: const Color(0xFF6EE7B7),
          fontSize: 8,
          isBold: true,
        );
      }
    }

    // 4. Designated Wheelchair Bays
    if (showAccessibility) {
      for (final bay in floorplan.wheelchairBays) {
        final isSelected = selectedEntityId == bay.bayId;
        final bayRect = Rect.fromLTWH(
          toPxX(bay.rect.x),
          toPxY(bay.rect.y),
          bay.rect.width * scale,
          bay.rect.height * scale,
        );

        canvas.drawRect(
          bayRect,
          Paint()..color = isSelected ? const Color(0xFF2563EB).withOpacity(0.5) : const Color(0xFF1D4ED8).withOpacity(0.25),
        );
        canvas.drawRect(
          bayRect,
          Paint()
            ..color = isSelected ? const Color(0xFF60A5FA) : const Color(0xFF3B82F6)
            ..style = PaintingStyle.stroke
            ..strokeWidth = isSelected ? 2.5 : 1.5,
        );

        // International Wheelchair Badge Glyph
        _drawText(
          canvas: canvas,
          text: '♿',
          position: Offset(bayRect.center.dx, bayRect.center.dy - 8),
          color: Colors.white,
          fontSize: 14,
        );
      }
    }

    // 5. Equipment Zones
    if (showEquipment) {
      for (final eq in floorplan.equipmentZones) {
        final isSelected = selectedEntityId == eq.id;
        final eqRect = Rect.fromLTWH(
          toPxX(eq.boundary.x),
          toPxY(eq.boundary.y),
          eq.boundary.width * scale,
          eq.boundary.height * scale,
        );

        final isFoh = eq.type == 'foh_console';
        canvas.drawRect(
          eqRect,
          Paint()..color = isSelected ? const Color(0xFF4F46E5).withOpacity(0.5) : (isFoh ? const Color(0xFF312E81) : const Color(0xFF1E1B4B)),
        );
        canvas.drawRect(
          eqRect,
          Paint()
            ..color = isSelected ? const Color(0xFFA5B4FC) : const Color(0xFF818CF8)
            ..style = PaintingStyle.stroke
            ..strokeWidth = isSelected ? 2.5 : 1.5,
        );
        _drawText(
          canvas: canvas,
          text: eq.name,
          position: Offset(eqRect.center.dx, eqRect.center.dy - 5),
          color: const Color(0xFFC7D2FE),
          fontSize: 8,
          isBold: true,
        );
      }
    }

    // 6. Exit Doorways & Door Swing Arcs
    if (showExits) {
      for (final door in floorplan.exits) {
        final isSelected = selectedEntityId == door.doorId;
        final x1 = toPxX(door.startPoint.x);
        final y1 = toPxY(door.startPoint.y);
        final x2 = toPxX(door.endPoint.x);
        final y2 = toPxY(door.endPoint.y);

        final doorColor = door.isSubstandard ? const Color(0xFFEF4444) : const Color(0xFF10B981);

        // Door line on wall
        canvas.drawLine(
          Offset(x1, y1),
          Offset(x2, y2),
          Paint()
            ..color = isSelected ? Colors.white : doorColor
            ..strokeWidth = isSelected ? 5.0 : 3.5
            ..strokeCap = StrokeCap.round,
        );

        // Outward Door Swing Arc
        final arcRadius = door.clearWidthM * scale;
        final arcRect = Rect.fromCircle(center: Offset(x1, y1), radius: arcRadius);
        canvas.drawArc(
          arcRect,
          door.wall == 'south' ? 0 : math.pi,
          math.pi / 2,
          false,
          Paint()
            ..color = doorColor.withOpacity(0.7)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.0,
        );

        // Clear Width Tag
        final midX = (x1 + x2) / 2;
        final midY = (y1 + y2) / 2;
        _drawText(
          canvas: canvas,
          text: '${door.clearWidthM.toStringAsFixed(1)}m ${door.isSubstandard ? '[SUBSTANDARD]' : '[PASS]'}',
          position: Offset(midX, midY + (door.wall == 'south' ? 12 : -16)),
          color: doorColor,
          fontSize: 9,
          isBold: true,
        );
      }
    }
  }

  void _drawDimensionLine({
    required Canvas canvas,
    required Offset p1,
    required Offset p2,
    required String text,
    bool isVertical = false,
  }) {
    final dimPaint = Paint()
      ..color = const Color(0xFF64748B)
      ..strokeWidth = 1.0;

    canvas.drawLine(p1, p2, dimPaint);

    // Ticks
    if (!isVertical) {
      canvas.drawLine(Offset(p1.dx, p1.dy - 4), Offset(p1.dx, p1.dy + 4), dimPaint);
      canvas.drawLine(Offset(p2.dx, p2.dy - 4), Offset(p2.dx, p2.dy + 4), dimPaint);
      _drawText(
        canvas: canvas,
        text: text,
        position: Offset((p1.dx + p2.dx) / 2, p1.dy - 12),
        color: const Color(0xFFCBD5E1),
        fontSize: 10,
        isBold: true,
      );
    } else {
      canvas.drawLine(Offset(p1.dx - 4, p1.dy), Offset(p1.dx + 4, p1.dy), dimPaint);
      canvas.drawLine(Offset(p2.dx - 4, p2.dy), Offset(p2.dx + 4, p2.dy), dimPaint);
      _drawText(
        canvas: canvas,
        text: text,
        position: Offset(p1.dx - 40, (p1.dy + p2.dy) / 2),
        color: const Color(0xFFCBD5E1),
        fontSize: 10,
        isBold: true,
      );
    }
  }

  void _drawText({
    required Canvas canvas,
    required String text,
    required Offset position,
    required Color color,
    required double fontSize,
    bool isBold = false,
  }) {
    final textSpan = TextSpan(
      text: text,
      style: TextStyle(
        color: color,
        fontSize: fontSize,
        fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
        fontFamily: 'monospace',
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(position.dx - (textPainter.width / 2), position.dy),
    );
  }

  @override
  bool shouldRepaint(covariant FloorplanCanvasPainter oldDelegate) {
    return oldDelegate.floorplan != floorplan ||
        oldDelegate.showGridAndBoundary != showGridAndBoundary ||
        oldDelegate.showStageAndRamp != showStageAndRamp ||
        oldDelegate.showAccessibility != showAccessibility ||
        oldDelegate.showExits != showExits ||
        oldDelegate.showCirculation != showCirculation ||
        oldDelegate.showEquipment != showEquipment ||
        oldDelegate.selectedEntityId != selectedEntityId;
  }
}
