import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'core/firebase/firebase_options.dart';
import 'core/firebase/emulator_config.dart';
import 'core/theme/app_theme.dart';
import 'core/routing/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
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

    runApp(MaterialApp(
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
      title: 'Eventalogy',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: appRouter,
    );
  }
}
