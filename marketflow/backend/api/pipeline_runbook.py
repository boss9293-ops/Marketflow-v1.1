"""Flask blueprint: GET /api/pipeline-runbook  (WO-W19)"""

from flask import Blueprint, jsonify

pipeline_runbook_bp = Blueprint('pipeline_runbook', __name__)


@pipeline_runbook_bp.route('/api/pipeline-runbook', methods=['GET'])
def get_runbook():
    """Return deterministic operator runbook and recommended actions."""
    from services.pipeline_runbook import compute_runbook
    return jsonify(compute_runbook())
