import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import '../../core/config/api_config.dart';
import '../models/vendor_availability_model.dart';

class AvailabilityApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  AvailabilityApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/availability';

  Future<String?> _getToken() async {
    final provider = tokenProvider;
    if (provider != null) {
      return await provider();
    }
    try {
      return await FirebaseAuth.instance.currentUser?.getIdToken();
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _buildHeaders(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  String _parseErrorMessage(http.Response response, String defaultMsg) {
    try {
      final body = jsonDecode(response.body);
      if (body is Map && body.containsKey('error')) {
        return body['error'].toString();
      }
    } catch (_) {}
    return '$defaultMsg (${response.statusCode})';
  }

  /// Retrieve vendor availability configuration.
  Future<VendorAvailabilityModel> fetchAvailability(String vendorId) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/vendor/$vendorId');

    final response = await _client.get(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return VendorAvailabilityModel.fromJson(
        Map<String, dynamic>.from(data['config'] as Map),
      );
    }
    throw Exception(_parseErrorMessage(response, 'Failed to fetch availability configuration'));
  }

  /// Save or update vendor availability configuration.
  Future<VendorAvailabilityModel> saveAvailability(
    String vendorId,
    VendorAvailabilityModel config,
  ) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/vendor/$vendorId');

    final response = await _client.put(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(config.toJson()),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return VendorAvailabilityModel.fromJson(
        Map<String, dynamic>.from(data['config'] as Map),
      );
    }
    throw Exception(_parseErrorMessage(response, 'Failed to save availability configuration'));
  }

  /// Add a blackout date for vendor.
  Future<VendorAvailabilityModel> addBlackoutDate(
    String vendorId,
    BlackoutDateModel blackout,
  ) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/vendor/$vendorId/blackout');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode(blackout.toJson()),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return VendorAvailabilityModel.fromJson(
        Map<String, dynamic>.from(data['config'] as Map),
      );
    }
    throw Exception(_parseErrorMessage(response, 'Failed to add blackout date'));
  }

  /// Remove a blackout date for vendor.
  Future<VendorAvailabilityModel> removeBlackoutDate(
    String vendorId,
    String dateStr,
  ) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/vendor/$vendorId/blackout/$dateStr');

    final response = await _client.delete(url, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return VendorAvailabilityModel.fromJson(
        Map<String, dynamic>.from(data['config'] as Map),
      );
    }
    throw Exception(_parseErrorMessage(response, 'Failed to remove blackout date'));
  }

  /// Retrieve commitments/scheduled events for vendor.
  Future<List<VendorCommitmentModel>> fetchCommitments(
    String vendorId, {
    String? startDate,
    String? endDate,
    String? status,
    int? limit,
  }) async {
    final token = await _getToken();
    final queryParams = <String, String>{};
    if (startDate != null) queryParams['startDate'] = startDate;
    if (endDate != null) queryParams['endDate'] = endDate;
    if (status != null) queryParams['status'] = status;
    if (limit != null) queryParams['limit'] = limit.toString();

    final uri = Uri.parse('$_baseUrl/vendor/$vendorId/commitments').replace(
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    final response = await _client.get(uri, headers: _buildHeaders(token));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final list = (data['commitments'] as List<dynamic>?) ?? [];
      return list
          .map((item) => VendorCommitmentModel.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    }
    throw Exception(_parseErrorMessage(response, 'Failed to fetch vendor commitments'));
  }

  /// Check availability for a specific vendor on a given date.
  Future<AvailabilityCheckResultModel> checkAvailability({
    required String vendorId,
    required DateTime requestedDate,
    int? quantity,
  }) async {
    final token = await _getToken();
    final url = Uri.parse('$_baseUrl/check');

    final response = await _client.post(
      url,
      headers: _buildHeaders(token),
      body: jsonEncode({
        'vendorId': vendorId,
        'requestedDate': requestedDate.toIso8601String(),
        'quantity': quantity ?? 1,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return AvailabilityCheckResultModel.fromJson(
        Map<String, dynamic>.from(data['result'] as Map),
      );
    }
    throw Exception(_parseErrorMessage(response, 'Failed to check vendor availability'));
  }
}
