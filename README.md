# spin-but-slower

A Flask-based application that provides a slower version of spin functionality.

## Quick Start

1. Setup the environment:
```bash
./setup.sh
```

2. Run the application:
```bash
./run.sh
```

## Architecture

This is a simple Flask web application with the following components:

- `app.py`: Main application file containing the Flask server and core logic
- `public/`: Static files directory
- `logs/`: Directory for application logs
- `instances.json`: Configuration file for managing instances
- `script_template.sh`: Template for generating instance scripts

## Development Setup

### Prerequisites
- Python 3.x
- Virtual environment (venv)

### Installation Steps

1. Clone the repository:
```bash
git clone [repository-url]
cd spin-but-slower
```

2. Run the setup script to create a virtual environment and install dependencies:
```bash
./setup.sh
```

3. Start the application:
```bash
./run.sh
```

### Maintenance

- Use `clear_cache.sh` to clean up cached data when needed
- Logs are stored in the `logs/` directory
- Update `instances.json` to modify instance configurations

## Dependencies

- Flask 2.3.3
