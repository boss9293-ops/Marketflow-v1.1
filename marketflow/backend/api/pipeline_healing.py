"""
Healing strategy API — Flask Blueprint.
Register in app.py:
    from api.pipeline_healing import pipeline_healing_bp
    app.register_blueprint(pipeline_healing_bp)
"""
from flask import Blueprint, jsonify

pipeline_healing_bp = Blueprint('pipeline_healing', __name__)


@pipeline_healing_bp.route('/api/pipeline-healing', methods=['GET'])
def get_healing_plan():
    from services.pipeline_healing import compute_healing_plan
    return jsonify(compute_healing_plan())
