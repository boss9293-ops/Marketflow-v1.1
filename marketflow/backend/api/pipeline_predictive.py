"""Flask blueprint: GET /api/pipeline-predictive  (WO-W18)"""

from flask import Blueprint, jsonify

pipeline_predictive_bp = Blueprint('pipeline_predictive', __name__)


@pipeline_predictive_bp.route('/api/pipeline-predictive', methods=['GET'])
def get_predictive():
    """Return deterministic pipeline failure-risk score."""
    from services.pipeline_predictive import compute_predictive
    return jsonify(compute_predictive())
