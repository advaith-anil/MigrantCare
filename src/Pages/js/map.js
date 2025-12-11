let map;
const ws = new WebSocket("ws://localhost:3000");
let watchId;
let currentMarker;
let isPostingJob = false;

document.addEventListener('DOMContentLoaded', function() {
    map = L.map('map').setView([13.0827, 80.2707], 10); // Default to Chennai

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
});

document.addEventListener("DOMContentLoaded", async () => {
    const response = await fetch("/getUserSession");
    const user = await response.json();
    // Store user email globally
    window.userEmail = user.email;

    const controls = document.getElementById("controls");
    controls.innerHTML = ""; // Clear loading text

    if (user.userType === "employee") {
        controls.innerHTML = `
            <button class="map-btn" onclick="startSharingLocation()">Share My Location</button>
            <button class="map-btn" onclick="stopSharingLocation()">Stop Sharing</button>
            <br>
            <select id="jobFilter">
                <option value="all">All Jobs</option>
                <option value="Construction">Construction</option>
                <option value="Sales">Sales</option>
                <option value="Temp">Temp Workers</option>
            </select>
            <button class="filter" onclick="filterJobs()"><?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="30px" height="30px" viewBox="0 0 122.88 107.128" enable-background="new 0 0 122.88 107.128" xml:space="preserve"><g><path d="M2.788,0h117.297c1.544,0,2.795,1.251,2.795,2.795c0,0.85-0.379,1.611-0.978,2.124l-46.82,46.586v39.979 c0,1.107-0.643,2.063-1.576,2.516l-22.086,12.752c-1.333,0.771-3.039,0.316-3.812-1.016c-0.255-0.441-0.376-0.922-0.375-1.398 h-0.006V51.496L0.811,4.761C-0.275,3.669-0.27,1.904,0.822,0.819c0.544-0.541,1.255-0.811,1.966-0.811V0L2.788,0z M113.323,5.591 H9.493L51.851,48.24c0.592,0.512,0.966,1.27,0.966,2.114v49.149l16.674-9.625V50.354h0.008c0-0.716,0.274-1.432,0.822-1.977 L113.323,5.591L113.323,5.591z"/></g></svg></button>
        `;
    } else if (user.userType === "employer") {
        controls.innerHTML = `
            <button class="map-btn" onclick="trackEmployees()">Track Employees</button>
            <button class="map-btn" onclick="enableJobPosting()">Post Job</button>
            <button class="map-btn" onclick="manageEmployerJobs()">Edit Job</button>
        `;
    } else if (user.userType === "admin") {
        controls.innerHTML = `
            <button class="map-btn" onclick="manageJobs()">Manage Job Postings</button>
        `;
    }

    // Load the correct map behavior
    initMap(user.userType);

    // Load all jobs
    loadAllJobs();
});

const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', 
    iconSize: [25, 41], 
    iconAnchor: [12, 41], 
    popupAnchor: [1, -34], 
});

const jobIcon = L.icon({
    iconUrl: 'img/briefcase.png',
    iconSize: [30, 30], 
    iconAnchor: [15, 30], 
    popupAnchor: [0, -30], 
});

function initMap(userType) {
    if (!map) {
        map = L.map("map").setView([13.0827, 80.2707], 10); // Default to Chennai

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
    }

    if (userType === "employer") {
        map.on('click', onMapClick);
    }
}

function onMapClick(e) {
    if (isPostingJob) {
        const { lat, lng } = e.latlng;
        const title = prompt("Enter Job Title:");
        const description = prompt("Enter Job Description(Contact Number must be included):");
        const tags = prompt("Enter Tags (comma separated)(Construction, Sales, Temp):");
        const salary = prompt("Enter Salary:");

        if (title && description && tags) {
            postJob(lat, lng, title, description, tags, salary);
        } else {
            alert("Job title, description, tags and salary are required.");
        }
        isPostingJob = false;
    }
}

// Employees share live location
function startSharingLocation() {
    if ("geolocation" in navigator) {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "employee_location", latitude, longitude, email: window.userEmail }));
                } else {
                    console.error("WebSocket is not open. Ready state:", ws.readyState);
                }
                map.setView([latitude, longitude], 16); 
                
                if (currentMarker) {
                    map.removeLayer(currentMarker);
                }

                currentMarker = L.marker([latitude, longitude]).addTo(map).bindPopup('<div style="text-align: center;">You</div>').openPopup();
            },
            (error) => {
                console.error("Geolocation error:", error);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        alert("User denied the request for Geolocation. Please enable location services.");
                        break;
                    case error.POSITION_UNAVAILABLE:
                        alert("Location information is unavailable. Please try again later.");
                        break;
                    case error.TIMEOUT:
                        alert("The request to get user location timed out. Please try again.");
                        break;
                    case error.UNKNOWN_ERROR:
                        alert("An unknown error occurred. Please try again.");
                        break;
                }
                // Fallback to default location
                map.setView([13.0827, 80.2707], 16); // Default to Chennai
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

// Stop sharing location
function stopSharingLocation() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        if (currentMarker) {
            map.removeLayer(currentMarker);
            currentMarker = null;
        }
        alert("Location sharing stopped.");
    }
}

// Employers track only their assigned employees
async function loadAssignedEmployees() {
    try {
        const response = await fetch("/getUserSession");
        const user = await response.json();
        const email = user.email;

        // Fetch and mark employer's location
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const employerMarker = L.marker([latitude, longitude], { icon: redIcon })
                        .addTo(map)
                        .bindPopup(`<b>You</b>`);
                    employerMarker.openPopup();
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    alert("Error fetching employer location. Please ensure the location data is available.");
                },
                { enableHighAccuracy: true }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }

        // Fetch and mark employees' locations
        const workersResponse = await fetch(`/getEmployerWorkers?email=${email}`);
        const workers = await workersResponse.json();

        workers.forEach(async (worker) => {
            const workerEmail = worker.email;
            try {
                const response = await fetch(`/getEmployeeLocation?email=${workerEmail}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const location = await response.json();
                if (location && location.latitude && location.longitude) {
                    const marker = L.marker([location.latitude, location.longitude])
                        .addTo(map)
                        .bindPopup(`<b>${worker.name}</b>`);
                    marker.openPopup();
                } else {
                    console.error(`Location data for ${worker.name} is not available.`);
                }
            } catch (error) {
                console.error("Error fetching employee location:", error);
            }
        });
    } catch (error) {
        console.error("Error loading assigned employees:", error);
    }
}

// Track employees function
function trackEmployees() {
    loadAssignedEmployees();
}

// Employees view & filter jobs
async function filterJobs() {
    const selectedCategory = document.getElementById("jobFilter").value;
    try {
        const response = await fetch(`/getNearbyJobs?category=${selectedCategory}&status=Pending`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jobs = await response.json();

        // Clear existing job markers
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker && layer.options.icon === jobIcon) {
                map.removeLayer(layer);
            }
        });

        // Add new job markers
        jobs.forEach(job => {
            L.marker([job.location.coordinates[1], job.location.coordinates[0]], { icon: jobIcon })
                .addTo(map)
                .bindPopup(`<b>${job.title}</b><br>${job.description}<br>Tags: ${job.tags.join(', ')}<br>${job.salary}`);
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        alert('Error fetching jobs. Please try again later.');
    }
}

// Enable job posting
function enableJobPosting() {
    isPostingJob = true;
    alert("Click on the map to set the job location.");
}

// Employers post jobs
async function postJob(lat, lng, title, description, tags, salary) {
    await fetch("/postJob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, latitude: lat, longitude: lng, tags: tags.split(',').map(tag => tag.trim()), salary, status: "Pending" })
    });

    alert("Job Posted!");
}

// Admin manages job postings
async function manageJobs() {
    const response = await fetch("/getAllJobs");
    const jobs = await response.json();

    let jobList = "";
    jobs.forEach(job => {
        jobList += `
            <p>
                ${job.title} - Status: ${job.status} - 
                <button class="map-btn" onclick="editJob('${job._id}', '${job.title}', '${job.description}', '${job.tags.join(', ')}', '${job.salary}')">Edit</button>
                <button class="map-btn" onclick="deleteJob('${job._id}')">Delete</button>
                <button class="map-btn" onclick="locateJob(${job.location.coordinates[1]}, ${job.location.coordinates[0]}, '${job.title}')">Locate</button>
            </p>`;
    });

    document.getElementById("controls").innerHTML = jobList;
}

// Function to locate job on the map
function locateJob(lat, lng, title) {
    map.setView([lat, lng], 16);
    L.marker([lat, lng], { icon: jobIcon }).addTo(map).bindPopup(`<b>${title}</b>`).openPopup();
}

// Admin edits job postings
function editJob(id, title, description, tags, salary) {
    const newTitle = prompt("Enter new Job Title:", title);
    const newDescription = prompt("Enter new Job Description:", description);
    const newTags = prompt("Enter new Tags (comma separated)(Construction, Sales, Temp):", tags);
    const newSalary = prompt("Enter salary:", salary);

    if (newTitle && newDescription && newTags) {
        fetch("/editJob", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, title: newTitle, description: newDescription, tags: newTags.split(',').map(tag => tag.trim()), salary: newSalary })
        }).then(response => {
            if (response.ok) {
                alert("Job details updated successfully");
                manageJobs();
            } else {
                alert("Error updating job details");
            }
        });
    } else {
        alert("Job title, description, tags and salary are required.");
    }
}

// Admin deletes job postings
async function deleteJob(jobId) {
    await fetch(`/deleteJob?id=${jobId}`, { method: "DELETE" });
    alert("Job Deleted");
    manageJobs();
}

async function manageEmployerJobs() {
    const response = await fetch("/getAllJobs");
    const jobs = await response.json();

    let jobList = "";
    jobs.forEach(job => {
        if (job.postedBy === window.userEmail) {
            jobList += `
                <p>
                    ${job.title} - 
                    <button class="map-btn" onclick="editJob('${job._id}', '${job.title}', '${job.description}', '${job.tags.join(', ')}','${job.salary}')">Edit</button>
                    <button class="map-btn" onclick="markJobAsDone('${job._id}')">Mark as Done</button>
                    <button class="map-btn" onclick="locateJob(${job.location.coordinates[1]}, ${job.location.coordinates[0]}, '${job.title}')">Locate</button>
                </p>`;
        }
    });

    document.getElementById("controls").innerHTML = jobList;
}

async function markJobAsDone(jobId) {
    await fetch(`/markJobAsDone?id=${jobId}`, { method: "PUT" });
    alert("Job marked as done");
    manageEmployerJobs();
}

async function loadAllJobs() {
    const response = await fetch("/getAllJobs");
    const jobs = await response.json();

    jobs.forEach(job => {
        if (job.status === "Pending" || user.userType === "admin") {
            L.marker([job.location.coordinates[1], job.location.coordinates[0]], { icon: jobIcon })
                .addTo(map)
                .bindPopup(`<b>${job.title}</b><br>${job.description}<br>Tags: ${job.tags.join(', ')}<br> Salary: ${job.salary}`);
        }
    });
}