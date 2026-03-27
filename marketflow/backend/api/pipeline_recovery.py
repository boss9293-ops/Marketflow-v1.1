"""
Pipeline recovery API — Flask Blueprint.
Register in app.py:
    from api.pipeline_recovery import pipeline_recovery_bp
    app.register_blueprint(pipeline_recovery_bp)
"""
from flask import Blueprint, jsonify
from services.pipeline_recovery import compute_recovery

pipeline_recovery_bp = Blueprint('pipeline_recovery', __name__)


@pipeline_recovery_bp.route('/api/pipeline-recovery')
def pipeline_recovery():
    return jsonify(compute_recovery())
