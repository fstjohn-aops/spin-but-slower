from flask import Flask, send_from_directory
import os

app = Flask(__name__)

# Serve static files from public directory
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)

# Simple backend endpoint
@app.route('/api/test')
def test_endpoint():
    print("Backend endpoint hit! Hello from the console!")
    return {"message": "Hello from Flask!", "status": "success"}

if __name__ == '__main__':
    app.run(debug=True, port=5000) 