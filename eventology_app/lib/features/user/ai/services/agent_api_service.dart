import 'dart:async';
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../../../core/config/api_config.dart';
import '../models/agent_workflow_models.dart';

class AgentApiService {
  final http.Client _client;
  final String _baseUrl;
  final Future<String?> Function()? tokenProvider;

  AgentApiService({
    http.Client? client,
    String? baseUrl,
    this.tokenProvider,
  })  : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? '${ApiConfig.baseUrl}/api/agent';

  Future<String?> _getToken() async {
    if (tokenProvider != null) {
      return await tokenProvider!();
    }
    try {
      return await FirebaseAuth.instance.currentUser?.getIdToken();
    } catch (_) {
      return null;
    }
  }

  Map<String, String> _headers(String? token, {bool sse = false}) {
    return {
      'Content-Type': 'application/json',
      if (sse) 'Accept': 'text/event-stream',
      if (sse) 'Cache-Control': 'no-cache',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Stream<AgentStreamEvent> streamChat({
    required String message,
    String? conversationId,
    String? eventId,
    Map<String, dynamic>? initialRequirements,
  }) {
    final uri = Uri.parse('$_baseUrl/chat/stream');
    final body = {
      'message': message,
      if (conversationId != null && conversationId.isNotEmpty)
        'conversationId': conversationId,
      if (eventId != null && eventId.isNotEmpty) 'eventId': eventId,
      if (initialRequirements != null && initialRequirements.isNotEmpty)
        'initialRequirements': initialRequirements,
    };
    return _postSseStream(uri, body);
  }

  Stream<AgentStreamEvent> streamApprove({
    required String conversationId,
    required bool approved,
    String? note,
  }) {
    final uri = Uri.parse('$_baseUrl/approve/stream');
    return _postSseStream(uri, {
      'conversationId': conversationId,
      'approved': approved,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Stream<AgentStreamEvent> _postSseStream(
    Uri uri,
    Map<String, dynamic> body,
  ) async* {
    final token = await _getToken();
    final request = http.Request('POST', uri);
    request.headers.addAll(_headers(token, sse: true));
    request.body = jsonEncode(body);

    final streamed = await _client.send(request);

    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      final raw = await streamed.stream.bytesToString();
      String errMsg = 'Request failed (HTTP ${streamed.statusCode})';
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map && decoded['error'] != null) {
          errMsg = decoded['error'].toString();
        }
      } catch (_) {}
      throw Exception(errMsg);
    }

    String currentEventName = 'message';
    final dataBuffer = StringBuffer();

    await for (final line in streamed.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter())) {
      if (line.isEmpty) {
        if (dataBuffer.isNotEmpty) {
          final parsed = _parseSsePayload(
            currentEventName,
            dataBuffer.toString().trim(),
          );
          if (parsed != null) yield parsed;
          dataBuffer.clear();
          currentEventName = 'message';
        }
        continue;
      }

      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        currentEventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        if (dataBuffer.isNotEmpty) dataBuffer.write('\n');
        dataBuffer.write(line.substring(5).trim());
      }
    }

    if (dataBuffer.isNotEmpty) {
      final parsed = _parseSsePayload(
        currentEventName,
        dataBuffer.toString().trim(),
      );
      if (parsed != null) yield parsed;
    }
  }

  AgentStreamEvent? _parseSsePayload(String eventType, String jsonStr) {
    if (jsonStr.isEmpty) return null;
    try {
      final decoded = jsonDecode(jsonStr);
      if (decoded is! Map) return null;
      final map = Map<String, dynamic>.from(decoded);
      final rawState = map['state'];
      final state = rawState is Map
          ? AgentStateSnapshot.fromMap(Map<String, dynamic>.from(rawState))
          : null;

      return AgentStreamEvent(
        eventType: eventType,
        conversationId: map['conversationId']?.toString(),
        node: map['node']?.toString(),
        nextAgent: map['nextAgent']?.toString(),
        currentStage: map['currentStage']?.toString(),
        workflowStatus: map['workflowStatus']?.toString(),
        completedTasks: map['completedTasks'] is List
            ? (map['completedTasks'] as List).map((e) => e.toString()).toList()
            : null,
        state: state,
        interrupted: map['interrupted'] == true,
        error: map['error']?.toString(),
      );
    } catch (_) {
      return null;
    }
  }

  Future<AgentStateSnapshot?> fetchStatus(String conversationId) async {
    final token = await _getToken();
    final response = await _client.get(
      Uri.parse('$_baseUrl/status/$conversationId'),
      headers: _headers(token),
    );
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['state'] is Map) {
        return AgentStateSnapshot.fromMap(
          Map<String, dynamic>.from(decoded['state']),
        );
      }
    }
    return null;
  }

  Future<AgentStateSnapshot?> fetchEventWorkflow(String eventId) async {
    final token = await _getToken();
    final response = await _client.get(
      Uri.parse('$_baseUrl/event/$eventId'),
      headers: _headers(token),
    );
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['state'] is Map) {
        return AgentStateSnapshot.fromMap(
          Map<String, dynamic>.from(decoded['state']),
        );
      }
    }
    return null;
  }
}

/// Shared session state connecting the 5-step Planner, /ai-chat workspace,
/// and the persistent floating AI chat dock on the home screen.
class AgentSessionController extends ChangeNotifier {
  final AgentApiService _api = AgentApiService();

  String? _conversationId;
  String? _eventId;
  AgentStateSnapshot? _snapshot;
  final List<AgentChatMessage> _localMessages = [];
  final Set<String> _executedNodes = {};
  String? _activeNode;
  bool _isStreaming = false;
  bool _interrupted = false;
  String? _error;

  String? get conversationId => _conversationId;
  String? get eventId => _eventId;
  AgentStateSnapshot? get snapshot => _snapshot;
  List<AgentChatMessage> get messages {
    final serverMsgs = _snapshot?.messages ?? const <AgentChatMessage>[];
    if (serverMsgs.isEmpty) {
      return List.unmodifiable(_localMessages);
    }
    // Preserve optimistic trailing user message if server snapshot has not emitted it yet.
    if (_localMessages.isNotEmpty &&
        _localMessages.last.role == 'user' &&
        (serverMsgs.isEmpty ||
            serverMsgs.last.content.trim() != _localMessages.last.content.trim())) {
      return List.unmodifiable([...serverMsgs, _localMessages.last]);
    }
    return serverMsgs;
  }

  Set<String> get executedNodes => Set.unmodifiable(_executedNodes);
  String? get activeNode => _activeNode;
  bool get isStreaming => _isStreaming;
  bool get isInterrupted => _interrupted;
  String? get error => _error;

  void resetSession() {
    _conversationId = null;
    _eventId = null;
    _snapshot = null;
    _localMessages.clear();
    _executedNodes.clear();
    _activeNode = null;
    _isStreaming = false;
    _interrupted = false;
    _error = null;
    notifyListeners();
  }

  Future<void> startFromFiveStepPlanner({
    required String summaryPrompt,
    required Map<String, dynamic> requirements,
    String? eventId,
  }) async {
    resetSession();
    _eventId = eventId;
    await sendMessage(
      summaryPrompt,
      initialRequirements: requirements,
      eventId: eventId,
    );
  }

  Future<void> sendMessage(
    String text, {
    String? eventId,
    Map<String, dynamic>? initialRequirements,
    bool forceNew = false,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _isStreaming) return;

    if (forceNew) {
      _conversationId = null;
      _snapshot = null;
      _localMessages.clear();
      _executedNodes.clear();
      _interrupted = false;
    }

    _eventId = eventId ?? _eventId;
    _error = null;
    _isStreaming = true;
    _interrupted = false;
    _activeNode = initialRequirements != null && initialRequirements.isNotEmpty
        ? 'orchestrator_agent'
        : 'event_intake_agent';
    _localMessages.add(AgentChatMessage(role: 'user', content: trimmed));
    notifyListeners();

    try {
      await _consumeStream(
        _api.streamChat(
          message: trimmed,
          conversationId: _conversationId,
          eventId: _eventId,
          initialRequirements: initialRequirements,
        ),
      );
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _isStreaming = false;
      _activeNode = null;
      notifyListeners();
    }
  }

  Future<void> approvePlan({
    required bool approved,
    String? note,
  }) async {
    if (_conversationId == null || _isStreaming) return;

    _error = null;
    _isStreaming = true;
    _interrupted = false;
    _activeNode = 'approval_agent';
    notifyListeners();

    try {
      await _consumeStream(
        _api.streamApprove(
          conversationId: _conversationId!,
          approved: approved,
          note: note,
        ),
      );
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _isStreaming = false;
      _activeNode = null;
      notifyListeners();
    }
  }

  Future<void> loadExistingConversation(String conversationId) async {
    if (conversationId.isEmpty) return;
    _error = null;
    notifyListeners();
    try {
      final snap = await _api.fetchStatus(conversationId);
      if (snap != null) {
        _conversationId = snap.conversationId;
        _eventId = snap.eventId;
        _snapshot = snap;
        _executedNodes
          ..clear()
          ..addAll(snap.completedTasks);
        _interrupted = snap.workflowStatus == 'pending_user' ||
            snap.approvalStatus == 'pending' ||
            snap.hasActiveTechnicalHolds;
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      notifyListeners();
    }
  }

  Future<void> _consumeStream(Stream<AgentStreamEvent> stream) async {
    await for (final evt in stream) {
      if (evt.conversationId != null && evt.conversationId!.isNotEmpty) {
        _conversationId = evt.conversationId;
      }

      switch (evt.eventType) {
        case 'started':
          break;
        case 'node_update':
          if (evt.node != null && evt.node!.isNotEmpty) {
            _executedNodes.add(evt.node!);
            if (evt.nextAgent != null &&
                evt.nextAgent != '__end__' &&
                evt.nextAgent!.isNotEmpty) {
              _activeNode = evt.nextAgent == 'specialist_search'
                  ? 'venue_agent'
                  : evt.nextAgent;
            } else if (evt.node != 'orchestrator_agent') {
              _activeNode = 'orchestrator_agent';
            }
          }
          if (evt.completedTasks != null) {
            _executedNodes.addAll(evt.completedTasks!);
          }
          break;
        case 'state_update':
          if (evt.state != null) {
            _snapshot = evt.state;
            _executedNodes.addAll(evt.state!.completedTasks);
          }
          break;
        case 'interrupt':
          _interrupted = true;
          _activeNode = null;
          break;
        case 'complete':
          if (evt.state != null) {
            _snapshot = evt.state;
            _executedNodes.addAll(evt.state!.completedTasks);
          }
          _interrupted = evt.interrupted ||
              (_snapshot?.approvalStatus == 'pending') ||
              (_snapshot?.hasActiveTechnicalHolds ?? false);
          _isStreaming = false;
          _activeNode = null;
          break;
        case 'error':
          _error = evt.error ?? 'Agent workflow failed.';
          _isStreaming = false;
          _activeNode = null;
          break;
      }

      notifyListeners();
    }

    if (_isStreaming) {
      _isStreaming = false;
      _activeNode = null;
      notifyListeners();
    }
  }
}

final AgentSessionController agentSessionController = AgentSessionController();
