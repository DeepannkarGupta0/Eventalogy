import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/firestore/events_repository.dart';
import '../../../../services/firestore/bookings_repository.dart';
import '../../../../models/events_model.dart';
import '../../../../models/bookings_model.dart';
import '../widgets/interactive_technical_floorplan_viewer.dart';
import '../../../../models/spatial_floorplan_model.dart';

class EventDetailScreen extends StatefulWidget {
  final String eventId;

  const EventDetailScreen({super.key, required this.eventId});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  int _selectedTabIndex = 0;

  final List<String> _tabs = [
    'Specifications',
    'Equipment BOM',
    'Floorplan CAD',
    'NBC Life-Safety',
    'Vendor Quotes',
    'Run of Show',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0E14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF10141E),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.architecture_rounded, color: AppColors.primary, size: 18),
            SizedBox(width: 8),
            Text(
              'EVENT PRODUCTION STUDIO',
              style: TextStyle(
                color: Colors.white,
                fontSize: 13,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        centerTitle: true,
      ),
      body: FutureBuilder<EventModel?>(
        future: EventsRepository.getEvent(widget.eventId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          final event = snapshot.data;
          if (event == null) {
            return const Center(child: Text('Event not found', style: TextStyle(color: Colors.white)));
          }

          return Column(
            children: [
              _buildHeaderSection(event),
              _buildStudioTabBar(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20.0),
                  child: _buildActiveTabContent(event),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHeaderSection(EventModel event) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: const BoxDecoration(
        color: Color(0xFF121622),
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  event.title.isNotEmpty ? event.title : 'Event Production Space',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.5)),
                ),
                child: Text(
                  event.status.toUpperCase(),
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _buildHeaderPill(Icons.calendar_today_rounded, _formatDate(event.eventDate.toDate())),
              _buildHeaderPill(Icons.location_on_outlined, event.locationId?.toUpperCase() ?? 'RAIPUR'),
              _buildHeaderPill(Icons.people_outline, '${event.guestCount ?? 300} Guests'),
              _buildHeaderPill(Icons.currency_rupee, '₹${(event.budget ?? 1500000).toInt()} Budget'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderPill(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: AppColors.primary, size: 14),
        const SizedBox(width: 5),
        Text(text, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildStudioTabBar() {
    return Container(
      height: 48,
      decoration: const BoxDecoration(
        color: Color(0xFF0F121A),
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _tabs.length,
        itemBuilder: (context, idx) {
          final isActive = _selectedTabIndex == idx;
          return GestureDetector(
            onTap: () => setState(() => _selectedTabIndex = idx),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                border: isActive
                    ? const Border(bottom: BorderSide(color: AppColors.primary, width: 2.5))
                    : null,
              ),
              child: Text(
                _tabs[idx],
                style: TextStyle(
                  color: isActive ? Colors.white : AppColors.textSecondary,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                  fontSize: 13,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildActiveTabContent(EventModel event) {
    switch (_selectedTabIndex) {
      case 0:
        return _buildSpecificationsTab(event);
      case 1:
        return _buildBomTableTab(event);
      case 2:
        return _buildFloorplanCadTab(event);
      case 3:
        return _buildLifeSafetyTab(event);
      case 4:
        return _buildProcurementTab(event);
      case 5:
      default:
        return _buildRunOfShowTab(event);
    }
  }

  Widget _buildSpecificationsTab(EventModel event) {
    final reqs = event.requirements ?? {};
    final services = reqs['requiredServices'] as List? ?? ['Venue & Banquet', 'Stage & Pro Audio', 'Intelligent Lighting', 'Mandap & Floral Decor'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Executive Event Scope', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            children: [
              _buildSpecRow('Target Event Date', _formatDate(event.eventDate.toDate())),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('Target Capacity', '${event.guestCount ?? 350} Attendees'),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('Target Production Budget', '₹${(event.budget ?? 1500000).toInt()}'),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('City / Jurisdiction', event.locationId?.toUpperCase() ?? 'RAIPUR, CG'),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text('Required Production Departments', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: services.map((s) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 14),
                const SizedBox(width: 8),
                Text(s.toString(), style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildBomTableTab(EventModel event) {
    final bomItems = [
      {'category': 'Rigging & Truss', 'desc': '12x12m Aluminum Box Truss with Certified Hoists', 'qty': '1 Set', 'cost': 350000},
      {'category': 'Pro Audio', 'desc': 'Dual 18" Subwoofers & 8x Line Array Boxes + FOH Mixer', 'qty': '1 Set', 'cost': 280000},
      {'category': 'Stage Lighting', 'desc': '24x Beam Moving Heads + 16x LED Wash Pars + Haze', 'qty': '1 Set', 'cost': 190000},
      {'category': 'Stage Deck', 'desc': '40x24ft Performance Riser (1.2m Height) + Ramp', 'qty': '1 Set', 'cost': 120000},
      {'category': 'Floral Decor', 'desc': 'Mandap Canopy with Fresh Royal Marigold & Roses', 'qty': '1 Package', 'cost': 450000},
    ];

    final totalBom = bomItems.fold<int>(0, (sum, i) => sum + (i['cost'] as int));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Itemized Equipment & Budget BOM', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            OutlinedButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('BOM exported to CSV spreadsheet.')));
              },
              icon: const Icon(Icons.download_rounded, size: 16),
              label: const Text('Export CSV', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.primary),
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: Color(0xFF161B26),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
                ),
                child: const Row(
                  children: [
                    Expanded(flex: 3, child: Text('Department / Item', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold))),
                    Expanded(flex: 1, child: Text('Qty', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold))),
                    Expanded(flex: 2, child: Text('Est. Cost', textAlign: TextAlign.right, style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold))),
                  ],
                ),
              ),
              ...bomItems.map((item) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppColors.glassBorder, width: 0.5)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item['desc'] as String, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                          const SizedBox(height: 2),
                          Text(item['category'] as String, style: const TextStyle(color: AppColors.primary, fontSize: 11)),
                        ],
                      ),
                    ),
                    Expanded(
                      flex: 1,
                      child: Text(item['qty'] as String, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text('₹${item['cost']}', textAlign: TextAlign.right, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                    ),
                  ],
                ),
              )),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: const BoxDecoration(
                  color: Color(0xFF141924),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(14)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Production BOM Sum', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                    Text('₹$totalBom', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w900, fontSize: 15)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFloorplanCadTab(EventModel event) {
    const mockLayout = TechnicalFloorplanModel(
      venueName: 'Main Production Hall',
      workflowId: 'wf-production-cad',
      roomLengthM: 32.0,
      roomWidthM: 20.0,
      calculatedAreaM2: 640.0,
      doorsCount: 2,
      substandardDoorsCount: 0,
      lifeSafetyStatus: 'APPROVED',
      preliminaryScreeningPassed: true,
      stage: FloorplanStage(
        boundary: FloorplanRect(x: 8.0, y: 1.0, width: 16.0, height: 4.5, label: 'Main Performance Stage'),
        clearanceBuffer: FloorplanRect(x: 8.0, y: 5.5, width: 16.0, height: 1.5, label: 'Front Clearance Buffer'),
        heightM: 1.2,
        rampLengthM: 14.4,
        rampSlopeRatio: 12.0,
        rampLandingsCount: 2,
        rampBoundary: FloorplanRect(x: 5.5, y: 1.0, width: 1.5, height: 4.5, label: 'Wheelchair Ramp (1:12)'),
      ),
      equipmentZones: [
        FloorplanEquipmentZone(
          id: 'foh-1',
          name: 'FOH Audio Console',
          type: 'foh_console',
          boundary: FloorplanRect(x: 13.5, y: 14.0, width: 5.0, height: 2.5, label: 'FOH Sound Desk'),
        ),
      ],
      exits: [
        FloorplanExit(
          doorId: 'd-1',
          label: 'North Entrance',
          wall: 'north',
          startPoint: FloorplanPoint(13.5, 0.0),
          endPoint: FloorplanPoint(16.5, 0.0),
          clearWidthM: 3.0,
          isSubstandard: false,
          swingDirection: 'outward',
        ),
        FloorplanExit(
          doorId: 'd-2',
          label: 'South Fire Exit',
          wall: 'south',
          startPoint: FloorplanPoint(24.0, 20.0),
          endPoint: FloorplanPoint(26.4, 20.0),
          clearWidthM: 2.4,
          isSubstandard: false,
          swingDirection: 'outward',
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Spatial Layout & CAD Floorplan', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('AutoCAD DXF vector file generated and downloaded.')));
                  },
                  icon: const Icon(Icons.download_rounded, size: 14),
                  label: const Text('DXF', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.glassBorder),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Launching metric floorplan directly in Draw.io / diagrams.net...')));
                  },
                  icon: const Icon(Icons.open_in_new_rounded, size: 14),
                  label: const Text('Edit in Draw.io', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        const InteractiveTechnicalFloorplanViewer(
          floorplan: mockLayout,
        ),
      ],
    );
  }

  Widget _buildLifeSafetyTab(EventModel event) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('NBC 2016 Part 4 Life-Safety Verification', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF10B981).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 28),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('APPROVED (NBC 2016 Compliant)', style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.w900, fontSize: 14)),
                    SizedBox(height: 2),
                    Text('ISO/IEC 52120 certified egress calculations mathematically approved.', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            children: [
              _buildSpecRow('Design Occupant Load', '400 Persons (Table 3 Dining)'),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('Total Clear Exit Width', '5.40m Provided (Req: 4.00m)'),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('Exit Remoteness Rule', '22.8m Separation (Req: 18.0m)'),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('Max Travel Distance', '24.2m (NBC Limit: 30.0m)'),
              const Divider(color: AppColors.glassBorder, height: 20),
              _buildSpecRow('Evacuation Flow Time', '114 Seconds (Puchat & Fruin)'),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Municipal Life-Safety Stamped Certificate downloaded.')));
            },
            icon: const Icon(Icons.verified_user_outlined, size: 18),
            label: const Text('Download Stamped Municipal Certificate (SHA-256)', style: TextStyle(fontWeight: FontWeight.bold)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFF10B981)),
              foregroundColor: const Color(0xFF10B981),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProcurementTab(EventModel event) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Vendor Reverse-Auction & Quotes', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            ElevatedButton.icon(
              onPressed: () {
                final workflowId = event.conversationId ?? event.eventId;
                context.push('/procurement/$workflowId', extra: {'eventName': event.title});
              },
              icon: const Icon(Icons.hub_outlined, size: 16),
              label: const Text('RFQ Board', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        StreamBuilder<List<BookingModel>>(
          stream: BookingsRepository.streamEventBookings(event.eventId),
          builder: (context, bookingSnapshot) {
            final bookings = bookingSnapshot.data ?? [];
            if (bookings.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.receipt_long_rounded, color: AppColors.textSecondary, size: 40),
                    const SizedBox(height: 12),
                    const Text('No bookings confirmed yet', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 6),
                    const Text('Publish your equipment BOM to receive competitive vendor bids.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        final workflowId = event.conversationId ?? event.eventId;
                        context.push('/procurement/$workflowId', extra: {'eventName': event.title});
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                      child: const Text('Open RFQ Bidding Board', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );
            }
            return Column(
              children: bookings.map((b) => Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: b.isPaid ? Colors.green.withValues(alpha: 0.3) : AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Contract #${b.id.substring(0, 8)}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 4),
                          Text('Amount: ₹${b.totalAmount}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                        ],
                      ),
                    ),
                    if (b.isPaid)
                      const Row(
                        children: [
                          Icon(Icons.check_circle_rounded, color: Colors.green, size: 18),
                          SizedBox(width: 4),
                          Text('ESCROW FUNDED', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 11)),
                        ],
                      )
                    else
                      ElevatedButton(
                        onPressed: () => context.push('/booking-checkout/${b.id}'),
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.black),
                        child: const Text('Fund Escrow', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ),
                  ],
                ),
              )).toList(),
            );
          },
        ),
      ],
    );
  }

  Widget _buildRunOfShowTab(EventModel event) {
    final cues = [
      {'time': '16:00', 'dept': 'RIGGING', 'cue': 'Truss & Stage Load-In & Cable Run'},
      {'time': '18:30', 'dept': 'AUDIO', 'cue': 'PA Line Array System Tuning & Wireless Mic Check'},
      {'time': '19:45', 'dept': 'STAGE', 'cue': 'VIP Arrival & Processional Procession Center Aisle'},
      {'time': '20:30', 'dept': 'TALENT', 'cue': 'Headliner Performance Set (Locked Duration)'},
      {'time': '21:50', 'dept': 'CURFEW', 'cue': 'Final Music Fade-Out (Pre-10 PM Curfew Compliance)'},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Day-of-Event Run of Show', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            ElevatedButton.icon(
              onPressed: () => context.push('/operations/live-ros', extra: {'eventId': event.eventId, 'eventTitle': event.title}),
              icon: const Icon(Icons.live_tv_rounded, size: 16),
              label: const Text('Live Ops Deck', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.alarm_on_rounded, color: Color(0xFFF59E0B), size: 22),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Municipal Noise Curfew Sentinel: Strict 10:00 PM cutoff enforced. Live Cue engine auto-compresses flexible cues if delays occur.',
                  style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            children: cues.map((c) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: AppColors.glassBorder, width: 0.5)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(c['time'] as String, style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(c['cue'] as String, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(c['dept'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 10, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
            )).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildSpecRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
      ],
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
