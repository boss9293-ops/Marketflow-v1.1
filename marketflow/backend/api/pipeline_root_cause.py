"""
Pipeline root cause analysis API -- Flask Blueprint.
Register in app.py:
    from api.pipeline_root_cause import pipeline_root_cause_bp
    app.register_blueprint(pipeline_root_cause_bp)
"""
from flask import Blueprint, jsonify
from services.pipeline_root_cause import compute_root_causes

pipeline_root_cause_bp = Blueprint('pipeline_root_cause', __name__)


@pipeline_root_cause_bp.route('/api/pipeline-root-causes')
def pipeline_root_causes():
    return jsonify(compute_root_causes())
