"""Flask blueprint: GET/POST /api/pipeline-ops-mode  (WO-W16)"""

from flask import Blueprint, jsonify, request

pipeline_ops_mode_bp = Blueprint('pipeline_ops_mode', __name__)


@pipeline_ops_mode_bp.route('/api/pipeline-ops-mode', methods=['GET'])
def get_ops_mode():
    """Return current operator mode config."""
    from services.pipeline_ops_mode import load_ops_mode
    config = load_ops_mode()
    return jsonify({'ok': True, 'config': config})


@pipeline_ops_mode_bp.route('/api/pipeline-ops-mode', methods=['POST'])
def set_ops_mode():
    """Update operator mode config.  Body: JSON matching ops mode schema."""
    from services.pipeline_ops_mode import save_ops_mode
    data   = request.get_json(force=True, silent=True) or {}
    result = save_ops_mode(data)
    status = 200 if result.get('ok') else 400
    return jsonify(result), status
