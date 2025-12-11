document.getElementById('register-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission
    
    const userType = document.getElementById('user-type').value; // Get the selected user type

    // Redirect based on user type
    if (userType === 'admin') {
        window.location.href = '/adminregister';
    } else if (userType === 'employee') {
        window.location.href = '/employeeregister';
    } else if (userType === 'employer') {
        window.location.href = '/employerregister';
    }
});
