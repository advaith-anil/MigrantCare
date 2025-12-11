document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    const email = this.email.value;
    const password = this.password.value;
    const userType = this.userType.value;

    // Send a POST request to the login endpoint
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, userType })
    })
    .then(response => response.json())
    .then(data => {
        if (data.redirect) {
            // Redirect to the appropriate profile page based on user type
            if (userType === 'admin') {
                window.location.href = '/adminprofile';
            } else if (userType === 'employee') {
                window.location.href = '/employeeprofile';
            } else if (userType === 'employer') {
                window.location.href = '/employerprofile';
            }
        } else {
            // Display error message in the alert element
            document.getElementById('alert-message').innerText = data.message || 'Invalid Credentials';
            document.getElementById('login-alert').style.display = 'block';

            // Auto-hide the alert after 3 seconds
            setTimeout(() => {
                document.getElementById('login-alert').style.display = 'none';
            }, 3000);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('alert-message').innerText = 'An error occurred. Please try again.';
        document.getElementById('login-alert').style.display = 'block';
        setTimeout(() => {
            document.getElementById('login-alert').style.display = 'none';
        }, 3000);
    });
});
