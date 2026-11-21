import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../services/firestore/catalog_repository.dart';
import '../../../services/firestore/package_repository.dart';
import '../../../models/event_type_model.dart';
import '../../../models/package_model.dart';
import '../../../core/theme/app_colors.dart';

class EventPlannerScreen extends StatelessWidget {
  final String eventTypeId;
  
  const EventPlannerScreen({super.key, required this.eventTypeId});

  @override
  Widget build(BuildContext context) {
    
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text(
          'PACKAGES',
          style: TextStyle(
            fontSize: 12,
            color: AppColors.primary,
            letterSpacing: 2.0,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: AppColors.background.withOpacity(0.9),
      ),
      body: Stack(
        children: [
          Positioned(
            top: 200,
            left: -50,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.accentBlue.withOpacity(0.04),
              ),
            ),
          ),
          FutureBuilder<EventTypeModel?>(
            future: CatalogRepository.getEventType(eventTypeId),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Center(child: CircularProgressIndicator());
              }
              final eventType = snapshot.data;
              if (eventType == null) {
                return const Center(child: Text('Event type not found', style: TextStyle(color: Colors.white)));
              }
              return StreamBuilder<List<PackageModel>>(
                stream: PackageRepository.streamActivePackages(),
                builder: (context, packageSnapshot) {
                  if (packageSnapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final packages = packageSnapshot.data ?? [];
                  if (packages.isEmpty) {
                    return const Center(child: Text('No packages available yet', style: TextStyle(color: AppColors.textSecondary)));
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 120, 16, 120),
                    itemCount: packages.length,
                    itemBuilder: (context, index) {
                      final package = packages[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.glassBorder),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.05),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              package.name,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text('Featured', style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        package.description ?? 'No description provided.',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Request Quote',
                            style: TextStyle(color: AppColors.primary, fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                          GestureDetector(
                            onTap: () {
                              context.push('/ai-chat', extra: {
                                'initialMessage':
                                    'I am interested in customizing and booking the "${package.name}" package for ${eventType.name}. Please show me what is included, estimated breakdown, and available venues.',
                                'autoOpenWorkspace': true,
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [AppColors.primary, AppColors.primaryLight],
                                ),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withOpacity(0.3),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.tune_rounded, color: Colors.black, size: 16),
                                  SizedBox(width: 6),
                                  Text(
                                    'Customize',
                                    style: TextStyle(
                                      color: Colors.black,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      );
    },
  ),
],
      ),
    );
  }
}
