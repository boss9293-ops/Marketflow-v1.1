"""
Pipeline intelligence API — Flask Blueprint.
Register in app.py:
    from api.pipeline_intelligence import pipeline_intelligence_bp
    app.register_blueprint(pipeline_intelligence_bp)
"""
from flask import Blueprint, jsonify
from services.pipeline_intelligence import compute_intelligence

pipeline_intelligence_bp = Blueprint('pipeline_intelligence', __name__)


@pipeline_intelligence_bp.route('/api/pipeline-intelligence')
def pipeline_intelligence():
    return jsonify(compute_intelligence())
