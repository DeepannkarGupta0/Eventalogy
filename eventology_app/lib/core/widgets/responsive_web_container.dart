import 'package:flutter/material.dart';

/// Wraps page content in a centered, max-width constrained container
/// to ensure clean, professional layouts on widescreen and 4K desktop displays.
class ResponsiveWebContainer extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry padding;

  const ResponsiveWebContainer({
    super.key,
    required this.child,
    this.maxWidth = 1320.0,
    this.padding = const EdgeInsets.symmetric(horizontal: 24.0),
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: padding,
          child: child,
        ),
      ),
    );
  }
}
