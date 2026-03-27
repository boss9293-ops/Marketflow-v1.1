"""
Pipeline metrics API — Flask Blueprint.
Register in app.py:
    from api.pipeline_metrics import pipeline_metrics_bp
    app.register_blueprint(pipeline_metrics_bp)
"""
from flask import Blueprint, jsonify
from services.pipeline_metrics import compute_metrics, compute_failures

pipeline_metrics_bp = Blueprint('pipeline_metrics', __name__)


@pipeline_metrics_bp.route('/api/pipeline-metrics')
def pipeline_metrics():
    return jsonify(compute_metrics())


@pipeline_metrics_bp.route('/api/pipeline-failures')
def pipeline_failures():
    return jsonify(compute_failures())
