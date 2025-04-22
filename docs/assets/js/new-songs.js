document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    const loadingMessageElement = document.getElementById('loadingMessage');
    const progressTextElement = document.getElementById('progressText');

    const downloadQueue = []; // תור ההורדות הממתינות
    let isProcessingQueue = false; // דגל שמונע ריצה כפולה של מעבד התור

    const INTER_DOWNLOAD_DELAY_MS = 300; // השהייה קצרה יותר בין יצירת iframes
    const BUTTON_RESTORE_DELAY_MS = 3000; // זמן להשארת הכפתור במצב טעינה
    const IFRAME_REMOVE_DELAY_MS = 5000; // זמן לפני הסרת ה-iframe מה-DOM

    // פונקציה לעדכון הודעת הטעינה
    function updateLoadingMessage() {
        if (!loadingMessageElement || !progressTextElement) return;

        const buttonsInProgress = resultsTableBody.querySelectorAll('button.download-button-new.download-in-progress').length;
        const itemsInQueue = downloadQueue.length;

        if (buttonsInProgress > 0 || itemsInQueue > 0) {
            let message = "";
            if (buttonsInProgress > 0) {
                message += `מוריד ${buttonsInProgress} שירים... `;
            }
            if (itemsInQueue > 0) {
                message += `(${itemsInQueue} ממתינים)`;
            }
            progressTextElement.innerText = message.trim();
            if (!loadingMessageElement.classList.contains('show')) {
                loadingMessageElement.style.display = 'flex';
                loadingMessageElement.classList.add('show');
            }
        } else {
            if (loadingMessageElement.classList.contains('show')) {
                setTimeout(() => {
                     if (resultsTableBody.querySelectorAll('button.download-button-new.download-in-progress').length === 0 && downloadQueue.length === 0) {
                        loadingMessageElement.style.display = 'none';
                        loadingMessageElement.classList.remove('show');
                     }
                 }, 1000); // השהייה קטנה לפני הסתרה
            }
        }
    }

    // פונקציה להחזרת כפתור למצב רגיל
    function restoreButton(songSerial) {
        const button = resultsTableBody.querySelector(`button.download-button-new[data-song-serial="${songSerial}"]`);
        if (button && button.classList.contains('download-in-progress')) {
            const originalIconHTML = button.dataset.originalIcon || '<i class="fas fa-download"></i>';
            button.innerHTML = originalIconHTML;
            button.disabled = false;
            button.classList.remove('download-in-progress');
            delete button.dataset.originalIcon;
            console.log(`Iframe Trigger: Button restored for serial: ${songSerial}`);
            updateLoadingMessage(); // עדכן הודעה
        }
    }

    // פונקציה לעיבוד התור - עכשיו עם יצירת iframe
    function processQueue() {
        if (downloadQueue.length === 0) {
            isProcessingQueue = false;
            console.log("Iframe Trigger: Queue is empty. Stopping.");
            updateLoadingMessage();
            return;
        }

        isProcessingQueue = true;
        const item = downloadQueue.shift(); // קח את הפריט הבא

        console.log(`Iframe Trigger: Processing serial: ${item.songSerial}. Queue length: ${downloadQueue.length}`);
        updateLoadingMessage();

        try {
            // --- יצירת והפעלת ה-iframe ---
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none'; // חשוב שיהיה נסתר
            iframe.src = `https://drive.google.com/uc?export=download&id=${item.driveId}`; // שימוש ב-driveId!
            document.body.appendChild(iframe); // הוסף ל-DOM כדי שהניווט יתחיל
            console.log(`Iframe Trigger: iframe created and appended for driveId: ${item.driveId}`);
            // --------------------------------

            // קבע timeout להחזרת הכפתור של הפריט הזה
            setTimeout(() => {
                restoreButton(item.songSerial);
            }, BUTTON_RESTORE_DELAY_MS);

            // קבע timeout להסרת ה-iframe מה-DOM (אחרי שההורדה אמורה להתחיל)
            setTimeout(() => {
                try {
                    iframe.remove();
                    console.log(`Iframe Trigger: iframe removed for driveId: ${item.driveId}`);
                } catch (removeError) {
                    console.warn(`Iframe Trigger: Minor error removing iframe for driveId: ${item.driveId}`, removeError);
                }
            }, IFRAME_REMOVE_DELAY_MS);

            // קבע timeout להמשך עיבוד התור אחרי השהייה קצרה
            setTimeout(processQueue, INTER_DOWNLOAD_DELAY_MS);

        } catch (error) {
            console.error(`Iframe Trigger: Error creating/appending iframe for serial ${item.songSerial}:`, error);
            // אם יצירת ה-iframe נכשלה, החזר את הכפתור והמשך לתור
            restoreButton(item.songSerial);
            if (typeof showMessage === 'function') {
                showMessage(`שגיאה בהכנת ההורדה לשיר ${item.songSerial}.`);
            }
            // המשך לפריט הבא בתור מיד
            setTimeout(processQueue, 50); // עיכוב מינימלי
        }
    }

    // האזנה ללחיצות בטבלה
    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const button = target.closest('button.download-button-new');

            if (!button || button.disabled || button.classList.contains('download-in-progress')) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const row = button.closest('tr');
            if (!row) return;

            const songSerial = button.dataset.songSerial;
            // --- קבלת ה-driveId מה-button או מה-row ---
            const driveId = button.dataset.driveId || row.dataset.driveId;
            // ------------------------------------------

            if (driveId && songSerial) { // ודא שקיים גם driveId

                // שנה את מראה הכפתור
                button.disabled = true;
                button.classList.add('download-in-progress');
                button.dataset.originalIcon = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                // הוסף את הפריט לתור (כולל driveId)
                downloadQueue.push({
                    songSerial: songSerial,
                    driveId: driveId // שמור את ה-ID של דרייב
                });

                console.log(`Iframe Trigger: Added serial: ${songSerial} (driveId: ${driveId}) to queue. Queue length: ${downloadQueue.length}`);
                updateLoadingMessage(); // עדכן הודעה

                // אם התור לא רץ כרגע, הפעל אותו
                if (!isProcessingQueue) {
                    console.log("Iframe Trigger: Starting queue processing.");
                    processQueue();
                }

            } else {
                console.error('Iframe Trigger: driveId or songSerial missing.');
                 // החזר את הכפתור אם הייתה בעיה
                 const originalIconHTML = button.dataset.originalIcon || '<i class="fas fa-download"></i>';
                 button.innerHTML = originalIconHTML;
                 button.disabled = false;
                 button.classList.remove('download-in-progress');
                 delete button.dataset.originalIcon;
                if (typeof showMessage === 'function') {
                    showMessage("שגיאה: חסר מזהה קובץ (Drive ID) להורדה.");
                }
            }
        });
        console.log("New Songs Page: Iframe download trigger handler initialized.");
    } else {
         console.warn("New Songs Page: Results table body (tbody.songs-list) not found.");
    }
});