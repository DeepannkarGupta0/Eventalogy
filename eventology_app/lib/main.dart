import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/firebase/firebase_options.dart';
import 'core/firebase/emulator_config.dart';
import 'core/theme/app_theme.dart';
import 'core/routing/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Clean HTML5 URL path strategy (removes '#' from web URLs)
  usePathUrlStrategy();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    if (EmulatorConfig.useEmulator) {
      EmulatorConfig.configure();
    }
    runApp(const EventologyApp());
  } catch (e) {
    debugPrint('Firebase initialization failed: $e');

    runApp(const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('Failed to initialize application.\nPlease restart.', textAlign: TextAlign.center),
        ),
      ),
    ));
  }
}

class EventologyApp extends StatelessWidget {
  const EventologyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Eventology | Deterministic Event Production & Marketplace Platform',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: appRouter,
    );
  }
}
