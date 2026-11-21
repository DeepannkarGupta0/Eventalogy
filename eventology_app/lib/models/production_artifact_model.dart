class ArtifactSourceReference {
  final String title;
  final String sourceType;
  final String? url;
  final String? entityId;
  final String? retrievedAt;
  final String? notes;

  ArtifactSourceReference({
    required this.title,
    this.sourceType = 'catalog',
    this.url,
    this.entityId,
    this.retrievedAt,
    this.notes,
  });

  factory ArtifactSourceReference.fromJson(Map<String, dynamic> json) {
    return ArtifactSourceReference(
      title: json['title'] as String? ?? '',
      sourceType: json['sourceType'] as String? ?? 'catalog',
      url: json['url'] as String?,
      entityId: json['entityId'] as String?,
      retrievedAt: json['retrievedAt'] as String?,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'sourceType': sourceType,
      if (url != null) 'url': url,
      if (entityId != null) 'entityId': entityId,
      if (retrievedAt != null) 'retrievedAt': retrievedAt,
      if (notes != null) 'notes': notes,
    };
  }
}

class ProductionArtifact {
  final String artifactId;
  final String type;
  final String title;
  final String summary;
  final int version;
  final String format;
  final String mimeType;
  final String content;
  final String? contentUrl;
  final String? imageBase64;
  final String status;
  final bool requiresReview;
  final List<String> assumptions;
  final List<ArtifactSourceReference> sources;
  final Map<String, dynamic> metadata;
  final String createdAt;
  final String updatedAt;

  ProductionArtifact({
    required this.artifactId,
    required this.type,
    required this.title,
    required this.summary,
    this.version = 1,
    this.format = 'markdown',
    this.mimeType = 'text/markdown',
    this.content = '',
    this.contentUrl,
    this.imageBase64,
    this.status = 'draft',
    this.requiresReview = false,
    this.assumptions = const [],
    this.sources = const [],
    this.metadata = const {},
    required this.createdAt,
    required this.updatedAt,
  });

  factory ProductionArtifact.fromJson(Map<String, dynamic> json) {
    final rawAssumptions = json['assumptions'];
    final assumptionsList = rawAssumptions is List
        ? rawAssumptions.map((e) => e.toString()).toList()
        : <String>[];

    final rawSources = json['sources'];
    final sourcesList = rawSources is List
        ? rawSources
            .whereType<Map<String, dynamic>>()
            .map((e) => ArtifactSourceReference.fromJson(e))
            .toList()
        : <ArtifactSourceReference>[];

    final rawMetadata = json['metadata'];
    final metadataMap = rawMetadata is Map<String, dynamic>
        ? Map<String, dynamic>.from(rawMetadata)
        : <String, dynamic>{};

    int parsedVersion = 1;
    final rawVersion = json['version'];
    if (rawVersion is num) {
      parsedVersion = rawVersion.toInt();
    } else if (rawVersion is String) {
      parsedVersion = int.tryParse(rawVersion) ?? 1;
    }

    final rawReview = json['requiresReview'];
    final bool parsedReview = rawReview is bool
        ? rawReview
        : (rawReview?.toString().toLowerCase() == 'true');

    return ProductionArtifact(
      artifactId: json['artifactId']?.toString() ?? '',
      type: json['type']?.toString() ?? 'generic_document',
      title: json['title']?.toString() ?? 'Untitled Artifact',
      summary: json['summary']?.toString() ?? '',
      version: parsedVersion,
      format: json['format']?.toString() ?? 'markdown',
      mimeType: json['mimeType']?.toString() ?? 'text/markdown',
      content: json['content']?.toString() ?? '',
      contentUrl: json['contentUrl']?.toString(),
      imageBase64: json['imageBase64']?.toString(),
      status: json['status']?.toString() ?? 'draft',
      requiresReview: parsedReview,
      assumptions: assumptionsList,
      sources: sourcesList,
      metadata: metadataMap,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'artifactId': artifactId,
      'type': type,
      'title': title,
      'summary': summary,
      'version': version,
      'format': format,
      'mimeType': mimeType,
      'content': content,
      if (contentUrl != null) 'contentUrl': contentUrl,
      if (imageBase64 != null) 'imageBase64': imageBase64,
      'status': status,
      'requiresReview': requiresReview,
      'assumptions': assumptions,
      'sources': sources.map((e) => e.toJson()).toList(),
      'metadata': metadata,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}
