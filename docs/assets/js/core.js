var baseurl = baseurl || ''; // Ensure baseurl is available, provided by Jekyll layout
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalOkButton = document.getElementById('modalOkButton');
const nextObject = document.getElementById("nextObject");


function setCookie(name, value, daysToExpire) {
    var expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    var expires = "expires=" + expirationDate.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}


function showMessage(message) {
    if (!modalOverlay || !modalMessage || !modalOkButton) return;

    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex';


    modalOkButton.addEventListener('click', hideMessage);
    document.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleEnterKey);
}

function hideMessage() {
    if (!modalOverlay) return;
    modalOverlay.style.display = 'none';


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


function copyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        console.log('Text copied to clipboard');
        return true; // Indicate success
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false; // Indicate failure
    } finally {
        document.body.removeChild(textArea);
    }
}

// Removed the showCopiedMessage function as it's replaced by inline feedback



document.addEventListener("DOMContentLoaded", function() {

    if (nextObject) {
        nextObject.addEventListener("click", function(event) {
            event.preventDefault();
            window.location.href = baseurl + "/";
        });
    }




    document.body.addEventListener('click', function(event) {
        if (event.target.tagName === 'A' && event.target.hostname !== window.location.hostname) {
             gtag('event', 'click', {
               'event_category': 'Outbound Link',
               'event_label': event.target.href,
               'transport_type': 'beacon'
             });
        }
    });


     const searchFormGlobal = document.querySelector('#searchForm');
     if (searchFormGlobal) {
        searchFormGlobal.addEventListener('submit', function(event) {

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