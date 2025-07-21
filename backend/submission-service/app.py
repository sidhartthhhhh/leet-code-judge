# submission_service/app.py

from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS
import pika
import json
import uuid
from datetime import datetime

# --- Application Setup ---
app = Flask(__name__)
# --- IMPORTANT CHANGE HERE ---
# Configure CORS to allow requests from any origin to any route.
# This is suitable for development but should be more restrictive in production.
CORS(app, resources={r"/*": {"origins": "*"}})

# --- In-Memory Database ---
# In a real-world app, this would be a proper NoSQL database like MongoDB or Cassandra.
SUBMISSIONS_DB = {}

def get_rabbitmq_connection():
    """Establishes a connection to RabbitMQ."""
    # In production, use environment variables for credentials and host.
    try:
        connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
        return connection
    except pika.exceptions.AMQPConnectionError as e:
        print(f"Error connecting to RabbitMQ: {e}")
        return None

@app.route('/api/v1/submissions', methods=['POST'])
def create_submission():
    """
    Handles a new code submission, validates it, and queues it for judging.
    """
    data = request.get_json()
    if not data or not all(k in data for k in ['user_id', 'problem_id', 'code', 'language']):
        return jsonify({"error": "Missing required fields"}), 400

    submission_id = str(uuid.uuid4())
    
    # 1. Store the initial submission record with a PENDING status.
    SUBMISSIONS_DB[submission_id] = {
        "status": "PENDING",
        "submitted_at": datetime.utcnow().isoformat() + "Z",
        "result": None,
        **data
    }

    # 2. Prepare the job payload for the message queue.
    # In a real system, you'd fetch test cases from the Problem Service based on problem_id.
    job_payload = {
        "submission_id": submission_id,
        "code": data['code'],
        "language": data['language'],
        "test_cases": [
            {"input": "2 2\n", "output": "4"},
            {"input": "5 10\n", "output": "15"}
        ]
    }

    # 3. Publish the job to the queue.
    connection = get_rabbitmq_connection()
    if not connection:
        SUBMISSIONS_DB[submission_id]['status'] = 'QUEUE_ERROR'
        return jsonify({"error": "Failed to connect to the queuing service"}), 503

    try:
        channel = connection.channel()
        channel.queue_declare(queue='submission_queue', durable=True)
        
        channel.basic_publish(
            exchange='',
            routing_key='submission_queue',
            body=json.dumps(job_payload),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
            ))
        connection.close()
    except Exception as e:
        print(f"Error publishing to RabbitMQ: {e}")
        SUBMISSIONS_DB[submission_id]['status'] = 'QUEUE_ERROR'
        return jsonify({"error": "Failed to queue submission for processing"}), 500

    return jsonify({"submission_id": submission_id, "status": "PENDING"}), 202

@app.route('/api/v1/submissions/<submission_id>', methods=['GET'])
def get_submission_status(submission_id):
    """
    Allows the frontend to poll for the result of a submission.
    """
    submission = SUBMISSIONS_DB.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404
    
    # Return a clean view of the submission status
    response = {
        "submission_id": submission_id,
        "status": submission['status'],
        "submitted_at": submission['submitted_at'],
        "result": submission.get('result')
    }
    return jsonify(response)

@app.route('/internal/v1/submissions/<submission_id>/update', methods=['PATCH'])
def update_submission_result(submission_id):
    """
    A private endpoint for the Judge Worker to post the result of a submission.
    """
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({"error": "Invalid result payload"}), 400
        
    submission = SUBMISSIONS_DB.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404
    
    # Update the submission status and result details
    submission['status'] = data['status']
    submission['result'] = {
        "runtime_ms": data.get('runtime_ms'),
        "memory_kb": data.get('memory_kb')
    }
    print(f"Submission {submission_id} updated: {submission['status']}")
    return jsonify({"status": "updated"}), 200

if __name__ == '__main__':
    app.run(port=5000, debug=True)
