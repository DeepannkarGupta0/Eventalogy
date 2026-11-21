import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';

import '../../core/config/api_config.dart';

class AdminApiService {
  static const String baseUrl = '${ApiConfig.baseUrl}/api/admin'; // unified for local dev

  static Future<String?> _getToken() async {
    return await FirebaseAuth.instance.currentUser?.getIdToken();
  }

  static Future<void> verifyVendor(String vendorId) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/vendors/$vendorId/verify'),
      headers: {
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to verify vendor: ${response.body}');
    }
  }

  static Future<void> changeVendorStatus(String vendorId, String status) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/vendors/$vendorId/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'status': status}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to change vendor status: ${response.body}');
    }
  }

  static Future<void> cancelEvent(String eventId) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/events/$eventId/cancel'),
      headers: {
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to cancel event: ${response.body}');
    }
  }

  static Future<Map<String, dynamic>> signOffTechnicalReview({
    required String taskId,
    required String decision,
    required int artifactVersion,
    String? comments,
    String? licenseOrCredential,
  }) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/technical-reviews/$taskId/sign-off'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'decision': decision,
        'artifactVersion': artifactVersion,
        'comments': comments ?? '',
        'licenseOrCredential': licenseOrCredential,
      }),
    );
    if (response.statusCode != 200) {
      try {
        final errBody = jsonDecode(response.body);
        throw Exception(errBody['error'] ?? 'Sign-off failed (${response.statusCode})');
      } catch (e) {
        if (e is Exception && !e.toString().contains('FormatException')) rethrow;
        throw Exception('Sign-off failed (${response.statusCode}): ${response.body}');
      }
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<List<Map<String, dynamic>>> listEngineeringReviewers({String? status}) async {
    final token = await _getToken();
    final uri = status != null
        ? Uri.parse('$baseUrl/engineering-reviewers?status=$status')
        : Uri.parse('$baseUrl/engineering-reviewers');
    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to list engineering reviewers: ${response.body}');
    }
    final data = jsonDecode(response.body);
    return List<Map<String, dynamic>>.from(data['reviewers'] ?? []);
  }

  static Future<Map<String, dynamic>> provisionEngineeringReviewer({
    required String targetUid,
    required String email,
    String? displayName,
    required List<String> disciplines,
    required List<String> roles,
    String? licenseOrRegistrationNumber,
    String? notes,
  }) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/engineering-reviewers'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'targetUid': targetUid,
        'email': email,
        'displayName': displayName,
        'disciplines': disciplines,
        'roles': roles,
        'licenseOrRegistrationNumber': licenseOrRegistrationNumber,
        'notes': notes,
      }),
    );
    if (response.statusCode != 201) {
      final errBody = jsonDecode(response.body);
      throw Exception(errBody['error'] ?? 'Failed to provision reviewer (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> revokeEngineeringReviewer({
    required String targetUid,
    required String reason,
  }) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/engineering-reviewers/$targetUid/revoke'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'reason': reason}),
    );
    if (response.statusCode != 200) {
      final errBody = jsonDecode(response.body);
      throw Exception(errBody['error'] ?? 'Failed to revoke reviewer (${response.statusCode})');
    }
    return jsonDecode(response.body) as Map<String, dynamic>;
  }
}
