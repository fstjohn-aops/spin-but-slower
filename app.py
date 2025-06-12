from flask import Flask, send_from_directory, request, jsonify
import subprocess
import os
import tempfile
import threading
import uuid
import time
import json
from datetime import datetime

app = Flask(__name__)

# In-memory storage for job status (use Redis/database in production)
jobs = {}

# File to store successful instances
INSTANCES_FILE = 'instances.json'

def load_instances():
    """Load saved instances from JSON file"""
    try:
        if os.path.exists(INSTANCES_FILE):
            with open(INSTANCES_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return []

def save_instance(hostname_prefix, job_id, completed_at, log_file):
    """Save a successful instance to JSON file"""
    try:
        instances = load_instances()
        new_instance = {
            'hostname_prefix': hostname_prefix,
            'job_id': job_id,
            'completed_at': completed_at,
            'log_file': log_file,
            'id': len(instances) + 1
        }
        instances.append(new_instance)
        
        with open(INSTANCES_FILE, 'w') as f:
            json.dump(instances, f, indent=2)
        
        print(f"Saved instance: {hostname_prefix}")
    except Exception as e:
        print(f"Error saving instance: {e}")

def clear_instances_cache():
    """Clear the instances cache by removing the JSON file"""
    try:
        if os.path.exists(INSTANCES_FILE):
            os.remove(INSTANCES_FILE)
            print("Instances cache cleared")
            return True
        return False
    except Exception as e:
        print(f"Error clearing cache: {e}")
        return False

def ping_hostname(hostname):
    """Ping a hostname and return True if reachable"""
    try:
        # Use ping command (works on both macOS and Linux)
        result = subprocess.run(['ping', '-c', '1', '-W', '3000', hostname], 
                              capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

def prefix_exists_in_cache(prefix):
    """Check if a prefix already exists in our cache"""
    instances = load_instances()
    return any(instance['hostname_prefix'].lower() == prefix.lower() for instance in instances)

# Serve static files from public directory
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)

def run_script_background(job_id, received_text):
    """Run the bash script in background and update job status"""
    try:
        jobs[job_id]['status'] = 'running'
        jobs[job_id]['started_at'] = datetime.now().isoformat()
        
        # Create log filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_filename = f"logs/script_{timestamp}_{job_id}.log"
        
        # Read the bash script template
        with open('script_template.sh', 'r') as f:
            script_template = f.read()
        
        # Template in the Python variables
        templated_script = script_template.format(
            received_text=received_text
        )
        
        # Create a temporary script file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as temp_script:
            temp_script.write(templated_script)
            temp_script_path = temp_script.name
        
        # Make the script executable
        os.chmod(temp_script_path, 0o755)
        
        # Execute the templated bash script and capture output to log file
        with open(log_filename, 'w') as log_file:
            # Write initial log info
            log_file.write(f"Job ID: {job_id}\n")
            log_file.write(f"Hostname Prefix: {received_text}\n")
            log_file.write(f"Start Time: {datetime.now().isoformat()}\n")
            log_file.write("-" * 80 + "\n\n")
            
            # Execute script and capture output
            result = subprocess.run(
                ['bash', temp_script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Write script output to log file
            log_file.write("STDOUT:\n")
            log_file.write(result.stdout)
            if result.stderr:
                log_file.write("\nSTDERR:\n")
                log_file.write(result.stderr)
            log_file.write(f"\nExit Code: {result.returncode}\n")
        
        # Clean up the temporary file
        os.unlink(temp_script_path)
        
        # Update job status
        completed_at = datetime.now().isoformat()
        jobs[job_id]['status'] = 'completed' if result.returncode == 0 else 'failed'
        jobs[job_id]['completed_at'] = completed_at
        jobs[job_id]['log_file'] = log_filename
        jobs[job_id]['return_code'] = result.returncode
        
        # Save successful instances
        if result.returncode == 0:
            save_instance(received_text, job_id, completed_at, log_filename)
        
        print(f"Job {job_id} completed with return code: {result.returncode}")
        print(f"Log file written to: {log_filename}")
            
    except Exception as e:
        jobs[job_id]['status'] = 'failed'
        jobs[job_id]['completed_at'] = datetime.now().isoformat()
        jobs[job_id]['error'] = str(e)
        print(f"Job {job_id} failed with error: {e}")

# Start a background job
@app.route('/api/start', methods=['POST'])
def start_job():
    # Get data from request
    data = request.get_json()
    received_text = data.get('text', '') if data else ''
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Initialize job status
    jobs[job_id] = {
        'id': job_id,
        'status': 'queued',
        'received_text': received_text,
        'created_at': datetime.now().isoformat()
    }
    
    print(f"Starting job {job_id} with text: '{received_text}'")
    
    # Start the script in background thread
    thread = threading.Thread(target=run_script_background, args=(job_id, received_text))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'job_id': job_id,
        'status': 'queued',
        'message': 'Job started successfully'
    })

# Check job status
@app.route('/api/status/<job_id>')
def get_job_status(job_id):
    if job_id not in jobs:
        return jsonify({'error': 'Job not found'}), 404
    
    job = jobs[job_id]
    return jsonify(job)

# Validate prefix endpoint (checks both cache and ping)
@app.route('/api/validate/<prefix>')
def validate_prefix(prefix):
    hostname = f"{prefix}.aopstest.com"
    
    # Check if prefix exists in cache first
    if prefix_exists_in_cache(prefix):
        return jsonify({
            'valid': False,
            'reason': 'cache',
            'message': f'Prefix "{prefix}" has already been used to create an instance',
            'hostname': hostname
        })
    
    # Check if hostname is reachable
    is_reachable = ping_hostname(hostname)
    if is_reachable:
        return jsonify({
            'valid': False,
            'reason': 'ping',
            'message': f'Hostname {hostname} is already reachable',
            'hostname': hostname
        })
    
    # Prefix is available
    return jsonify({
        'valid': True,
        'message': f'Prefix "{prefix}" is available',
        'hostname': hostname
    })

# Clear instances cache
@app.route('/api/clear-cache', methods=['POST'])
def clear_cache():
    success = clear_instances_cache()
    if success:
        return jsonify({
            'success': True,
            'message': 'Instances cache cleared successfully'
        })
    else:
        return jsonify({
            'success': False,
            'message': 'No cache to clear or error occurred'
        }), 400

# Ping check endpoint (kept for backward compatibility)
@app.route('/api/ping/<prefix>')
def ping_check(prefix):
    hostname = f"{prefix}.aopstest.com"
    is_reachable = ping_hostname(hostname)
    
    return jsonify({
        'hostname': hostname,
        'reachable': is_reachable,
        'status': 'online' if is_reachable else 'offline'
    })

# Get all successful instances
@app.route('/api/instances')
def get_instances():
    instances = load_instances()
    return jsonify(instances)

# Get all jobs (for debugging)
@app.route('/api/jobs')
def get_all_jobs():
    return jsonify(list(jobs.values()))

# Serve log files
@app.route('/logs/<path:filename>')
def serve_log(filename):
    return send_from_directory('logs', filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)