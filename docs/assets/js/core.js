// assets/js/core.js

// --- Global Variables & DOM Elements ---
var baseurl = baseurl || ''; // Ensure baseurl is available, provided by Jekyll layout
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalOkButton = document.getElementById('modalOkButton');
const nextObject = document.getElementById("nextObject"); // Site Logo/Title link

// --- Cookie Management ---
function setCookie(name, value, daysToExpire) {
    var expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    var expires = "expires=" + expirationDate.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// --- Modal Message System ---
function showMessage(message) {
    if (!modalOverlay || !modalMessage || !modalOkButton) return; // Guard clause

    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex';

    // Use named functions for listeners to allow removal
    modalOkButton.addEventListener('click', hideMessage);
    document.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleEnterKey);
}

function hideMessage() {
    if (!modalOverlay) return;
    modalOverlay.style.display = 'none';

    // Remove listeners to prevent memory leaks
    modalOkButton.removeEventListener('click', hideMessage);
    document.removeEventListener('click', handleOverlayClick);
    document.removeEventListener('keydown', handleEnterKey);
}

function handleOverlayClick(event) {
    if (event.target === modalOverlay) {
        hideMessage();
    }
}

function handleEnterKey(event) {
    if (event.key === 'Enter' && modalOverlay && modalOverlay.style.display === 'flex') {
        hideMessage();
    }
}

// --- Clipboard Utilities ---
function copyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed'; // Avoid scrolling
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        console.log('Text copied to clipboard');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        // Optionally show an error message to the user
    }
    document.body.removeChild(textArea);
}

function showCopiedMessage() {
    const message = document.createElement('div');
    message.textContent = 'הקישור הועתק ללוח';
    message.classList.add('copied-message'); // Ensure this class is styled in personal.css

    document.body.appendChild(message);

    setTimeout(() => {
        if (document.body.contains(message)) {
            document.body.removeChild(message);
        }
    }, 3000);
}


// --- Site-Wide Initializations ---
document.addEventListener("DOMContentLoaded", function() {
    // Site Logo Click Handler
    if (nextObject) {
        nextObject.addEventListener("click", function(event) {
            event.preventDefault(); // Prevent default link behavior
            window.location.href = baseurl + "/"; // Redirect to home page
        });
    }

    // Google Analytics Event Listeners (Example - adapt as needed)
    // Basic page view is handled by gtag include, add specific events here if universal
    // Example: Track clicks on external links
    document.body.addEventListener('click', function(event) {
        if (event.target.tagName === 'A' && event.target.hostname !== window.location.hostname) {
             gtag('event', 'click', {
               'event_category': 'Outbound Link',
               'event_label': event.target.href,
               'transport_type': 'beacon' // Optional: ensures data is sent even if page unloads
             });
        }
    });

     // GA for Search Form Submission (if search form is present)
     const searchFormGlobal = document.querySelector('#searchForm'); // Use querySelector for flexibility
     if (searchFormGlobal) {
        searchFormGlobal.addEventListener('submit', function(event) {
            // Note: Specific search logic might prevent default elsewhere (e.g., in search.js)
            const searchInputGlobal = document.querySelector('#searchInput');
            if (searchInputGlobal) {
                 const searchQuery = searchInputGlobal.value;
                 gtag('event', 'search', {
                    'event_category': 'Search',
                    'event_label': searchQuery
                 });
            }
        });
     }

});
