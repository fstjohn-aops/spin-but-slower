#!/bin/bash

# Script executed from Flask backend

echo "=== Script started ==="
echo "Received text from frontend: '{received_text}'"
echo "Current timestamp: $(date)"
echo ""

# run create new instance with no input
# CI=true time create-new-test-instance.sh '{received_text}'

env | sort

echo "Hello wrold!!!!!"

echo ""
echo "=== Script completed ==="