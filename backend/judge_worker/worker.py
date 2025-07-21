# judge_worker/worker.py

import pika
import json
import time
import docker
import requests
import os

# --- Configuration ---
SUBMISSION_API_URL = "http://localhost:5000/internal/v1/submissions"

def execute_code_in_sandbox(submission_data):
    """
    Runs user code in a secure, isolated Docker container and evaluates its output.
    """
    client = docker.from_env()
    code = submission_data['code']
    lang = submission_data['language']
    submission_id = submission_data['submission_id']
    
    image_map = {
        "python": "python:3.10-slim",
        "cpp": "gcc:latest" # Assumes a container that can compile and run C++
    }
    if lang not in image_map:
        return {"status": "Unsupported Language", "runtime_ms": 0, "memory_kb": 0}

    # Create a temporary directory for the submission files
    temp_dir = f"/tmp/{submission_id}"
    os.makedirs(temp_dir, exist_ok=True)
    
    # Write user code to a file
    code_file_path = os.path.join(temp_dir, "main.py" if lang == "python" else "main.cpp")
    with open(code_file_path, "w") as f:
        f.write(code)

    # This is a simplified execution loop. A real system would be more robust.
    for i, test_case in enumerate(submission_data['test_cases']):
        input_data = test_case['input']
        expected_output = test_case['output']
        
        # Command to execute inside the container
        command = ["python", "main.py"] if lang == "python" else ["./a.out"]
        
        try:
            container = client.containers.run(
                image=image_map[lang],
                command=command,
                stdin_open=True,
                detach=True,
                volumes={os.path.abspath(temp_dir): {'bind': '/app', 'mode': 'rw'}},
                working_dir="/app",
                mem_limit="256m",
                network_disabled=True,
            )

            # Write input to container's stdin
            socket = container.attach_socket(params={'stdin': 1, 'stream': 1})
            socket._sock.sendall(input_data.encode('utf-8'))
            socket.close()

            # Wait for container to finish, with a timeout
            result = container.wait(timeout=5) # 5-second time limit per test case
            
            exit_code = result.get('StatusCode', -1)
            output = container.logs().decode('utf-8').strip()
            
            container.remove(force=True)

            if exit_code != 0:
                return {"status": "Runtime Error", "runtime_ms": 5000, "memory_kb": 0}
            
            if output != expected_output:
                return {"status": "Wrong Answer", "runtime_ms": 100, "memory_kb": 0}

        except docker.errors.ContainerError as e:
            return {"status": "Runtime Error", "runtime_ms": 100, "memory_kb": 0}
        except Exception as e: # Catches timeouts from container.wait()
            # Ensure container is removed on timeout
            if 'container' in locals():
                container.remove(force=True)
            return {"status": "Time Limit Exceeded", "runtime_ms": 5000, "memory_kb": 0}
        finally:
            # Clean up the temporary directory
            import shutil
            shutil.rmtree(temp_dir)

    # If all test cases pass
    return {"status": "Accepted", "runtime_ms": 120, "memory_kb": 15200} # Mocked runtime/memory

def report_result(submission_id, result):
    """Sends the final result back to the submission service."""
    try:
        requests.patch(
            f"{SUBMISSION_API_URL}/{submission_id}/update",
            json=result,
            timeout=5 # Set a timeout for the API call
        )
        print(f"Successfully reported result for {submission_id}")
    except requests.exceptions.RequestException as e:
        print(f" [!] Failed to update status for {submission_id}: {e}")
        # In a real system, you'd implement a retry mechanism or a dead-letter queue.

def callback(ch, method, properties, body):
    """Callback function executed when a message is received from the queue."""
    print(f" [x] Received job for submission.")
    submission_data = json.loads(body)
    submission_id = submission_data.get('submission_id', 'unknown')

    try:
        result = execute_code_in_sandbox(submission_data)
        report_result(submission_id, result)
    except Exception as e:
        print(f" [!] An unexpected error occurred while processing {submission_id}: {e}")
        # Report a system error status
        error_result = {"status": "System Error"}
        report_result(submission_id, error_result)
    finally:
        # Acknowledge the message so RabbitMQ knows it has been processed.
        ch.basic_ack(delivery_tag=method.delivery_tag)

def main():
    """Main consumer loop to listen for submission jobs."""
    while True:
        try:
            connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
            channel = connection.channel()
            channel.queue_declare(queue='submission_queue', durable=True)
            # This ensures a worker only gets one message at a time.
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue='submission_queue', on_message_callback=callback)
            
            print(' [*] Waiting for submission jobs. To exit press CTRL+C')
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError:
            print("Connection to RabbitMQ failed. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            print("Interrupted. Shutting down.")
            break

if __name__ == '__main__':
    main()
