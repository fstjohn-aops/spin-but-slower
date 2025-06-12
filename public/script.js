document.addEventListener('DOMContentLoaded', function() {
    let currentJobId = null;
    let pollInterval = null;

    // Load previous instances on page load
    loadInstances();

    // Add event listener for clear cache button
    document.getElementById('clearCacheBtn').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the instances cache? This will remove all previously created instance records.')) {
            clearCache();
        }
    });

    document.getElementById('textForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const inputValue = document.getElementById('textInput').value.trim();
        const submitButton = document.querySelector('input[type="submit"]');
        const spinner = document.getElementById('loadingSpinner');
        const resultContainer = document.getElementById('resultContainer');
        
        // Basic validation
        if (!inputValue) {
            showResult('failure', 'Please enter a hostname prefix');
            return;
        }
        
        // Hide any previous results
        resultContainer.style.display = 'none';
        resultContainer.innerHTML = '';
        
        // Disable the submit button and show validation state
        submitButton.disabled = true;
        submitButton.value = 'Validating...';
        
        console.log('Validating hostname prefix:', inputValue);
        
        // Use the new validation endpoint that checks both cache and ping
        fetch(`/api/validate/${inputValue}`)
            .then(response => response.json())
            .then(data => {
                if (!data.valid) {
                    // Show appropriate error message based on reason
                    if (data.reason === 'cache') {
                        showResult('failure', `Prefix "${inputValue}" has already been used to create an instance. Please choose a different prefix.`);
                    } else if (data.reason === 'ping') {
                        showResult('failure', `Hostname ${data.hostname} is already reachable. Please choose a different prefix.`);
                    } else {
                        showResult('failure', data.message);
                    }
                    resetUI();
                } else {
                    // Prefix is available - proceed with provisioning
                    console.log('Prefix validation passed:', data.message);
                    startProvisioning(inputValue, submitButton, spinner);
                }
            })
            .catch(error => {
                console.error('Error validating prefix:', error);
                showResult('failure', 'Error validating prefix. Please try again.');
                resetUI();
            });
    });

    function clearCache() {
        const clearButton = document.getElementById('clearCacheBtn');
        clearButton.disabled = true;
        clearButton.textContent = 'Clearing...';
        
        fetch('/api/clear-cache', {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Cache cleared successfully');
                    showResult('success', 'Instances cache cleared successfully');
                    loadInstances(); // Refresh the instances display
                } else {
                    showResult('failure', data.message || 'Failed to clear cache');
                }
            })
            .catch(error => {
                console.error('Error clearing cache:', error);
                showResult('failure', 'Error clearing cache. Please try again.');
            })
            .finally(() => {
                clearButton.disabled = false;
                clearButton.textContent = 'Clear Cache';
            });
    }

    function startProvisioning(inputValue, submitButton, spinner) {
        // Show loading state and spinner
        submitButton.value = 'Starting...';
        spinner.style.display = 'block';
        
        console.log('Starting EC2 provisioning script...');
        
        // Start the background job
        fetch('/api/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: inputValue
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.job_id) {
                    currentJobId = data.job_id;
                    console.log('Job started with ID:', currentJobId);
                    submitButton.value = 'Running...';
                    
                    // Start polling for status
                    startPolling(currentJobId, inputValue);
                } else {
                    throw new Error('No job ID returned');
                }
            })
            .catch(error => {
                console.error('Error starting job:', error);
                showResult('failure', `Failed to start job: ${error.message}`);
                resetUI();
            });
    }

    function loadInstances() {
        fetch('/api/instances')
            .then(response => response.json())
            .then(instances => {
                displayInstances(instances);
            })
            .catch(error => {
                console.error('Error loading instances:', error);
            });
    }

    function displayInstances(instances) {
        const instancesContainer = document.getElementById('instancesContainer');
        const instancesList = document.getElementById('instancesList');
        
        instancesList.innerHTML = '';
        
        if (instances.length === 0) {
            instancesList.innerHTML = '<div class="no-instances">No instances created yet</div>';
        } else {
            instances.reverse().forEach(instance => {
                const instanceItem = document.createElement('div');
                instanceItem.className = 'instance-item';
                
                const date = new Date(instance.completed_at);
                const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                const hostname = `${instance.hostname_prefix}.aopstest.com`;
                
                instanceItem.innerHTML = `
                    <div class="instance-left">
                        <div class="instance-prefix">${instance.hostname_prefix}</div>
                        <div class="instance-hostname">${hostname}</div>
                    </div>
                    <div class="instance-right">
                        <div class="instance-date">${formattedDate}</div>
                        <div class="ping-status checking" id="ping-${instance.id}">
                            Checking...
                        </div>
                    </div>
                `;
                
                instancesList.appendChild(instanceItem);
                
                // Start ping check for this instance
                checkPingStatus(instance.hostname_prefix, instance.id);
            });
        }
        
        // Show the instances container
        instancesContainer.style.display = 'block';
    }

    function checkPingStatus(prefix, instanceId) {
        fetch(`/api/ping/${prefix}`)
            .then(response => response.json())
            .then(data => {
                const pingElement = document.getElementById(`ping-${instanceId}`);
                if (pingElement) {
                    if (data.reachable) {
                        pingElement.className = 'ping-status online';
                        pingElement.textContent = 'Online';
                    } else {
                        pingElement.className = 'ping-status offline';
                        pingElement.textContent = 'Offline';
                    }
                }
            })
            .catch(error => {
                console.error(`Error pinging ${prefix}:`, error);
                const pingElement = document.getElementById(`ping-${instanceId}`);
                if (pingElement) {
                    pingElement.className = 'ping-status offline';
                    pingElement.textContent = 'Error';
                }
            });
    }

    function startPolling(jobId, hostnamePrefix) {
        // Poll every 1 second
        pollInterval = setInterval(() => {
            fetch(`/api/status/${jobId}`)
                .then(response => response.json())
                .then(data => {
                    console.log('Job status:', data.status);
                    
                    if (data.status === 'running') {
                        const submitButton = document.querySelector('input[type="submit"]');
                        submitButton.value = 'Running...';
                        
                        // Show elapsed time if available
                        if (data.started_at) {
                            const startTime = new Date(data.started_at);
                            const elapsed = Math.floor((new Date() - startTime) / 1000);
                            submitButton.value = `Running... (${elapsed}s)`;
                        }
                    } else if (data.status === 'completed') {
                        console.log('Job completed successfully!');
                        console.log('Script output:', data.output);
                        if (data.errors) {
                            console.log('Script errors:', data.errors);
                        }
                        stopPolling();
                        resetUI();
                        showResult('success', `EC2 instance provisioned successfully with prefix: ${hostnamePrefix}`);
                        
                        // Reload instances to show the new one
                        loadInstances();
                    } else if (data.status === 'failed') {
                        console.log('Job failed!');
                        if (data.output) console.log('Script output:', data.output);
                        if (data.errors) console.log('Script errors:', data.errors);
                        if (data.error) console.log('Error:', data.error);
                        stopPolling();
                        resetUI();
                        showResult('failure', 'EC2 provisioning failed. Check console for details.');
                    }
                })
                .catch(error => {
                    console.error('Error polling status:', error);
                });
        }, 1000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function resetUI() {
        const submitButton = document.querySelector('input[type="submit"]');
        const spinner = document.getElementById('loadingSpinner');
        
        submitButton.disabled = false;
        submitButton.value = 'Submit';
        spinner.style.display = 'none';
        currentJobId = null;
    }

    function showResult(type, message) {
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.innerHTML = `<div class="result-${type}">${message}</div>`;
        resultContainer.style.display = 'block';
    }

    // Clean up polling if user leaves the page
    window.addEventListener('beforeunload', function() {
        stopPolling();
    });
}); 