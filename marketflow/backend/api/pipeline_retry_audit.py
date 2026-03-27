"""
Retry audit API — Flask Blueprint.
Register in app.py:
    from api.pipeline_retry_audit import pipeline_retry_audit_bp
    app.register_blueprint(pipeline_retry_audit_bp)
"""
from flask import Blueprint, jsonify

pipeline_retry_audit_bp = Blueprint('pipeline_retry_audit', __name__)


@pipeline_retry_audit_bp.route('/api/pipeline-retry-audit', methods=['GET'])
def get_retry_audit():
    from services.pipeline_retry_audit import get_audit_summary
    return jsonify(get_audit_summary())
