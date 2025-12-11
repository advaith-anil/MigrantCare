document.addEventListener('DOMContentLoaded', async function() {
    const userType = localStorage.getItem('userType');
    const emailId = localStorage.getItem('email');
    let collection = '';

    function setProfileLink(userType) {
        const profileLink = document.querySelector('.link[href="#"]');
        if (userType === 'admin') {
            profileLink.href = '/adminprofile';
        } else if (userType === 'employee') {
            profileLink.href = '/employeeprofile';
        } else if (userType === 'employer') {
            profileLink.href = '/employerprofile';
        }
    }

    if (!userType || !emailId) {
        console.error('User type or email ID is missing from localStorage');
        // Attempt to restore localStorage from the server session
        try {
            const response = await fetch('/getUserSession');
            const data = await response.json();
            if (data.userType && data.email) {
                localStorage.setItem('userType', data.userType);
                localStorage.setItem('email', data.email);
                window.location.reload(); // Reload the page after restoring session data
            } else {
                throw new Error('Failed to restore session data');
            }
        } catch (error) {
            window.alert('Unauthorized');
            window.location.href = '/login'; // Redirect to login if session restoration fails
        }
        return;
    }

    if (userType === 'admin') {
        collection = 'admins';
    } else if (userType === 'employee') {
        collection = 'employees';
    } else if (userType === 'employer') {
        collection = 'employers';
    }

    if (collection) {
        try {
            const response = await fetch(`/users?collection=${collection}&email=${emailId}`);
            const data = await response.json();

            if (response.ok) {
                // Fetch name and photo URL from the database
                const name = data.firstName + ' ' + data.lastName;
                document.getElementById('user').innerHTML = name;
                document.getElementById('img').src = data.photo; 
                document.getElementById('user-pic').src = data.photo;

                setProfileLink(userType); // Set the profile link based on user type
            } else {
                throw new Error('User not logged in');
            }
        } catch (error) {
            alert('Unauthorized');
            window.location.href = '/login'; // Redirect to login if fetching user session fails
        }
    } else {
        console.error('Invalid user type');
        window.location.href = '/login'; // Redirect to login if user type is invalid
    }
});

