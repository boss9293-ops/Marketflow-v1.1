"""
Retry policy API -- Flask Blueprint.
Register in app.py:
    from api.pipeline_retry_policy import pipeline_retry_policy_bp
    app.register_blueprint(pipeline_retry_policy_bp)
"""
from flask import Blueprint, jsonify, request
from services.pipeline_retry_policy import load_policy, save_policy, validate_policy

pipeline_retry_policy_bp = Blueprint('pipeline_retry_policy', __name__)


@pipeline_retry_policy_bp.route('/api/pipeline-retry-policy', methods=['GET'])
def get_retry_policy():
    return jsonify({'ok': True, 'policy': load_policy()})


@pipeline_retry_policy_bp.route('/api/pipeline-retry-policy', methods=['POST'])
def update_retry_policy():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({'ok': False, 'errors': ['Request body must be a JSON object.']}), 400

    saved, errors = save_policy(body)
    if errors:
        return jsonify({'ok': False, 'errors': errors}), 400

    return jsonify({'ok': True, 'policy': saved})
