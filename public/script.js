document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('textForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const inputValue = document.getElementById('textInput').value;
        const submitButton = document.querySelector('input[type="submit"]');
        const spinner = document.getElementById('loadingSpinner');
        
        // Disable the submit button, show loading state, and show spinner
        submitButton.disabled = true;
        submitButton.value = 'Running...';
        spinner.style.display = 'block';
        
        console.log('Starting long-running script...');
        
        // Hit the backend endpoint with POST request and send the form data
        fetch('/api/test', {
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
                console.log('Response from backend:', data);
                console.log('Form submitted with text:', inputValue);
                console.log('Script output from backend:', data.script_output);
                if (data.script_errors) {
                    console.log('Script errors:', data.script_errors);
                }
                console.log('Script completed successfully!');
            })
            .catch(error => {
                console.error('Error:', error);
            })
            .finally(() => {
                // Re-enable the submit button, hide spinner regardless of success or failure
                submitButton.disabled = false;
                submitButton.value = 'Submit';
                spinner.style.display = 'none';
                console.log('Submit button re-enabled');
            });
    });
}); 