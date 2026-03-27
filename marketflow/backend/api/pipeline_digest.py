"""Flask blueprint: GET /api/pipeline-digest  (WO-W20)"""

from flask import Blueprint, jsonify

pipeline_digest_bp = Blueprint('pipeline_digest', __name__)


@pipeline_digest_bp.route('/api/pipeline-digest', methods=['GET'])
def get_digest():
    """Return deterministic operator digest summary."""
    from services.pipeline_digest import compute_digest
    return jsonify(compute_digest())
