document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch('/admin/profile');
        const result = await response.json();

        if (result.success) {
            const name = result.user.firstName + ' ' + result.user.lastName;
            document.getElementById('profile-image').src = result.user.photo || '/images/profile.png';
            document.getElementById('user-pic').src = result.user.photo || '/images/profile.png';
            document.getElementById('img').src = result.user.photo || '/images/profile.png';
            document.getElementById('firstname').value = result.user.firstName || 'N/A';
            document.getElementById('lastname').value = result.user.lastName || 'N/A';
            document.getElementById('user').innerHTML = name || 'N/A';
            document.getElementById('father-name').value = result.user.fathersName || 'N/A';
            document.getElementById('mother-name').value = result.user.mothersName || 'N/A';
            document.getElementById('phone-number').value = result.user.phone || 'N/A';
            document.getElementById('emergency-contact').value = result.user.Emerphone || 'N/A';
            document.getElementById('aadhar-number').value = result.user.aadhaarNumber || 'N/A';
            document.getElementById('email-id').value = result.user.email || 'N/A';
            document.getElementById('date-of-birth').value = result.user.dob ? result.user.dob.split('T')[0] : 'N/A';
            document.getElementById('gender').value = result.user.gender || 'N/A';
            document.getElementById('address').value = result.user.CurrentAddress || 'N/A';
        } else {
            alert(result.message);
            window.location.href = '/login';
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
        if (error.response && error.response.status === 401) {
            alert("Unauthorized access. Please log in.");
            window.location.href = '/login';
        } else {
            alert("Error loading profile.");
        }
    }
});
