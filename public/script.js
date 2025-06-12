document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('textForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const inputValue = document.getElementById('textInput').value;
        
        // Hit the backend endpoint
        fetch('/api/test')
            .then(response => response.json())
            .then(data => {
                console.log('Response from backend:', data);
                console.log('Form submitted with text:', inputValue);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    });
}); 