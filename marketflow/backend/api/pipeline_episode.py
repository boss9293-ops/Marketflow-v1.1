"""Flask blueprint: GET /api/pipeline-episodes  (WO-W17)"""

from flask import Blueprint, jsonify

pipeline_episode_bp = Blueprint('pipeline_episode', __name__)


@pipeline_episode_bp.route('/api/pipeline-episodes', methods=['GET'])
def get_episodes():
    """Return computed incident episodes derived from run history."""
    from services.pipeline_episode import compute_episodes
    return jsonify(compute_episodes())
