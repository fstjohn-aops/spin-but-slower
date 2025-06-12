from flask import Flask, send_from_directory, request, jsonify
import subprocess
import os
import tempfile

app = Flask(__name__)

# Serve static files from public directory
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)

# Backend endpoint that runs templated bash code
@app.route('/api/test', methods=['POST'])
def test_endpoint():
    # Get data from request
    data = request.get_json()
    received_text = data.get('text', '') if data else ''
    
    print(f"Backend endpoint hit! Received data: '{received_text}'")
    
    try:
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
        
        # Execute the templated bash script
        result = subprocess.run(['bash', temp_script_path], capture_output=True, text=True)
        
        # Clean up the temporary file
        os.unlink(temp_script_path)
        
        print("Bash script output:")
        print(result.stdout)
        if result.stderr:
            print("Bash script errors:")
            print(result.stderr)
        
        return jsonify({
            "message": "Bash script executed successfully!",
            "received_text": received_text,
            "script_output": result.stdout,
            "script_errors": result.stderr,
            "status": "success"
        })
        
    except Exception as e:
        print(f"Error running bash script: {e}")
        return jsonify({
            "message": "Error running bash script",
            "received_text": received_text,
            "error": str(e),
            "status": "error"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)