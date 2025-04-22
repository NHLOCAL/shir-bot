# --- START OF FILE process_drive_folder.py ---

import os
import json
import csv
import datetime
import time
from pathlib import Path
import logging
import sys

# Google API Libraries
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Hebrew Date Conversion
from pyluach import dates, hebrewcal

# Certificate handling (important for requests/google libs)
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()

# --- Configuration & Constants ---
SCRIPT_DIR = Path(__file__).parent.resolve()
GDRIVE_SETUP_DIR = SCRIPT_DIR # For client_secret.json / initial token.json
STATE_FILE = SCRIPT_DIR / "drive_state.json" # State file name
CSV_FILE = SCRIPT_DIR / "new-songs.csv"      # CSV file name
TOKEN_FILE = SCRIPT_DIR / "token.json"       # Reused for target drive authentication
CLIENT_SECRET_FILE = GDRIVE_SETUP_DIR / 'client_secret_auth.json' # For target drive auth setup

# --- Google Drive IDs ---
# Keep the actual IDs here for the script logic, but avoid logging them directly
SOURCE_FOLDER_ID = "16C0em4CCbg0UX0mKCwqVY9WsgRaz_1TB" # Public source folder
TARGET_BASE_FOLDER_ID = "1Rh2QafUuSjb4inShuqXwpHmh_V5HlJac" # Private target base folder

# --- Google API ---
SCOPES = ['https://www.googleapis.com/auth/drive']

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def load_state():
    """Loads the last processed timestamp and next serial number from state file."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            state.setdefault("last_processed_timestamp", None)
            state.setdefault("next_serial", 1)
            logging.info(f"Loaded state: Last timestamp={state['last_processed_timestamp']}, Next serial={state['next_serial']}")
            return state
        except json.JSONDecodeError:
            logging.error(f"Error decoding JSON from {STATE_FILE}. Starting fresh.")
            return {"last_processed_timestamp": None, "next_serial": 1}
    else:
        logging.info(f"{STATE_FILE} not found. Starting fresh.")
        return {"last_processed_timestamp": None, "next_serial": 1}

def save_state(state):
    """Saves the current state (timestamp, serial) to the state file."""
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
        # logging.info(f"State saved: {state}") # Avoid logging potentially sensitive info if state grows
    except Exception as e:
        logging.error(f"Failed to save state to {STATE_FILE}: {e}")

def write_csv_header_if_needed():
    """Writes the CSV header if the file doesn't exist or is empty."""
    if not CSV_FILE.exists() or os.path.getsize(CSV_FILE) == 0:
        try:
            with open(CSV_FILE, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(["Serial Number", "Song Name", "Hebrew Date Folder", "Singer", "Copied Drive ID"])
            logging.info(f"Created CSV header in {CSV_FILE}")
        except Exception as e:
            logging.error(f"Failed to write CSV header to {CSV_FILE}: {e}")

def append_song_to_csv(serial, song_name, hebrew_folder, singer, copied_drive_id):
    """Appends a processed song's details to the CSV file."""
    try:
        with open(CSV_FILE, "a", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([serial, song_name, hebrew_folder, singer, copied_drive_id])
        # MODIFIED: Redacted copied_drive_id from log
        logging.info(f"Appended song Serial {serial} ('{song_name}') to {CSV_FILE} (Copied ID: <REDACTED>)")
    except Exception as e:
        logging.error(f"Failed to append song {serial} to {CSV_FILE}: {e}")

def convert_rfc3339_to_hebrew_month_year(rfc3339_str):
    """
    Converts an RFC 3339 timestamp string (from Drive API) to a cleaned
    Hebrew Month Year string suitable for a folder name (e.g., "אדר תשפה").
    """
    try:
        # Parse the RFC 3339 timestamp string
        if rfc3339_str.endswith('Z'):
            rfc3339_str = rfc3339_str[:-1] + '+00:00'
        dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
        # Convert to UTC naive datetime and then get the date part
        dt_utc_naive = dt_aware.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        g_date = dt_utc_naive.date()
        # Convert Gregorian date object to HebrewDate object
        heb_date = dates.GregorianDate(g_date.year, g_date.month, g_date.day).to_heb()

        # 1. Get the Hebrew month name
        heb_month_name = hebrewcal.Month(heb_date.year, heb_date.month).month_name(True)

        # 2. Get the full Hebrew date string which includes the formatted year
        full_heb_string = heb_date.hebrew_date_string(True) # e.g., 'ט״ו ניסן ה׳תשפ״ד'

        # 3. Extract the year part (usually the last word)
        parts = full_heb_string.split()
        heb_year_str_raw = ""
        if len(parts) > 0:
            heb_year_str_raw = parts[-1]
        else:
            # Fallback if string splitting fails
            logging.warning(f"Could not split '{full_heb_string}' to extract Hebrew year string from timestamp {rfc3339_str}.")
            heb_year_str_raw = str(heb_date.year) # Uses heb_date.year which should exist

        # --- START OF CLEANING LOGIC ---
        # 4. Clean the raw year string
        cleaned_year_str = heb_year_str_raw
        # Remove leading ה׳ if it exists
        if cleaned_year_str.startswith("ה׳"):
            cleaned_year_str = cleaned_year_str[2:]
        # Remove geresh (׳) and gershayim (״)
        cleaned_year_str = cleaned_year_str.replace("׳", "").replace("״", "")
        # --- END OF CLEANING LOGIC ---

        # 5. Combine them for the final folder name
        folder_name = f"{heb_month_name} {cleaned_year_str}"
        logging.debug(f"Generated folder name: '{folder_name}' from raw date '{rfc3339_str}' / raw year '{heb_year_str_raw}'")
        return folder_name

    except ImportError:
        logging.error("pyluach library not found. Cannot convert to Hebrew date. Install it using 'pip install pyluach'.")
        try:
            dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
            return dt_aware.strftime("%Y-%m") + " (Fallback - pyluach missing)"
        except:
             return "תאריך לא זמין"
    except Exception as e:
        logging.error(f"Error converting timestamp '{rfc3339_str}' to cleaned Hebrew date folder name: {e}", exc_info=True)
        try: # Fallback to YYYY-MM
            dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
            return dt_aware.strftime("%Y-%m") + " (Fallback - conversion error)"
        except:
             return "תאריך לא זמין"

def authenticate():
    """Authenticates the user for accessing the TARGET Google Drive."""
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')

    # --- GitHub Actions Authentication ---
    if token_json_content:
        logging.info("Attempting authentication using environment variable (GitHub Secret).")
        try:
            token_info = json.loads(token_json_content)
            creds = Credentials.from_authorized_user_info(token_info, SCOPES)
            if creds.expired and creds.refresh_token:
                logging.info("Refreshing credentials from environment variable.")
                try:
                    creds.refresh(Request())
                except Exception as e:
                    logging.error(f"Failed to refresh credentials from environment variable: {e}")
                    creds = None
            if creds and creds.valid:
                logging.info("Successfully authenticated using environment variable.")
                return creds
            else:
                logging.warning("Credentials from environment variable invalid/expired.")
                creds = None
        except Exception as e:
            logging.error(f"Error authenticating via environment variable: {e}")
            creds = None

    # --- Local Authentication ---
    logging.info("Attempting authentication using local token.json file.")
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception as e:
            logging.error(f"Error loading credentials from {TOKEN_FILE}: {e}")
            creds = None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logging.info(f"Refreshing credentials from local {TOKEN_FILE}.")
            try:
                creds.refresh(Request())
            except Exception as e:
                logging.error(f"Failed to refresh token from {TOKEN_FILE}: {e}. Manual re-auth needed?")
                creds = None

        if not creds or not creds.valid:
            if CLIENT_SECRET_FILE.exists():
                logging.info(f"No valid credentials. Starting auth flow using {CLIENT_SECRET_FILE}.")
                if 'GITHUB_ACTIONS' in os.environ and not token_json_content:
                     logging.error("Cannot run interactive auth flow in GitHub Actions without GDRIVE_TOKEN_JSON_CONTENT.")
                     return None
                try:
                    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_FILE), SCOPES)
                    try:
                        creds = flow.run_console()
                    except Exception:
                        logging.warning("Console flow failed, trying local server.")
                        creds = flow.run_local_server(port=0)
                except Exception as e:
                    logging.error(f"Authentication flow failed: {e}")
                    return None
                try:
                    with open(TOKEN_FILE, 'w') as token:
                        token.write(creds.to_json())
                    logging.info(f"Credentials saved to {TOKEN_FILE}")
                except Exception as e:
                    logging.error(f"Failed to save credentials to {TOKEN_FILE}: {e}")
            else:
                # MODIFIED: Redacted file paths from error message
                logging.error(f"Cannot authenticate: client_secret file not found and no valid token file or env var.")
                return None

    if creds and creds.valid:
        logging.info("Authentication successful.")
        return creds
    else:
        logging.error("Authentication failed.")
        return None


def get_or_create_folder(service, folder_name, parent_folder_id):
    """Gets the ID of a folder by name within a parent, creates it if it doesn't exist."""
    sanitized_name = folder_name.replace("'", "\\'")
    # MODIFIED: Redacted parent_folder_id from query for logging/safety, though API needs it.
    # The actual query sent to API still uses the real parent_folder_id.
    query = f"name='{sanitized_name}' and '<REDACTED_PARENT>' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    # Construct the actual query for the API call
    actual_query = f"name='{sanitized_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

    try:
        # Use actual_query for the API call
        response = service.files().list(q=actual_query, spaces='drive', fields='files(id, name)').execute()
        files = response.get('files', [])

        if files:
            folder_id = files[0]['id']
            # MODIFIED: Redacted folder_id and parent_folder_id from log
            logging.debug(f"Found existing folder: '{folder_name}' (ID: <REDACTED>) in parent <REDACTED>")
            return folder_id
        else:
             # MODIFIED: Redacted parent_folder_id from log
            logging.info(f"Folder '{folder_name}' not found in parent <REDACTED>. Creating it.")
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            folder = service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            # MODIFIED: Redacted folder_id and parent_folder_id from log
            logging.info(f"Created folder: '{folder_name}' (ID: <REDACTED>) in parent <REDACTED>")
            return folder_id
    except HttpError as error:
         # MODIFIED: Redacted parent_folder_id from error log
        logging.error(f"An API error occurred while finding/creating folder '{folder_name}' in parent <REDACTED>: {error}")
        if error.resp.status == 403:
            logging.error("Permission denied. Ensure the authenticated user/service account has EDITOR permissions for the target base folder.")
        raise
    except Exception as e:
        # MODIFIED: Redacted parent_folder_id from error log
        logging.error(f"An unexpected error occurred finding/creating folder '{folder_name}' in parent <REDACTED>: {e}")
        raise


def copy_file(service, source_file_id, target_folder_id, new_filename=None):
    """Copies a file to the target folder. Returns the ID of the new copy."""
    # MODIFIED: Redacted source_file_id and target_folder_id from log
    logging.info(f"Attempting to copy file ID: <REDACTED> to target folder ID: <REDACTED>")
    try:
        copy_metadata = {'parents': [target_folder_id]}
        if new_filename:
            copy_metadata['name'] = new_filename

        copied_file = service.files().copy(
            fileId=source_file_id,
            body=copy_metadata,
            fields='id, name'
        ).execute()

        copied_file_id = copied_file.get('id')
        copied_file_name = copied_file.get('name')
        # MODIFIED: Redacted copied_file_id and target_folder_id from log
        logging.info(f"Successfully copied file as '{copied_file_name}' (New ID: <REDACTED>) to folder <REDACTED>.")
        return copied_file_id
    except HttpError as error:
        # MODIFIED: Redacted source_file_id from error log
        logging.error(f"API error copying file ID <REDACTED>: {error}")
        if error.resp.status == 403:
             logging.error("Permission denied. Check permissions on target folder (need Editor) or access to source file.")
        elif error.resp.status == 404:
             logging.error("Source file or target folder not found.")
        return None
    except Exception as e:
        # MODIFIED: Redacted source_file_id from error log
        logging.error(f"Unexpected error copying file ID <REDACTED>: {e}")
        return None

# --- Main Processing Function ---

def main():
    logging.info("--- Drive Folder Copy Script Start ---")
    state = load_state()
    last_processed_timestamp = state.get("last_processed_timestamp")
    next_serial = state.get("next_serial")

    write_csv_header_if_needed()

    # --- Authenticate for Target Drive actions ---
    creds = authenticate()
    if not creds:
        logging.error("Authentication failed. Exiting.")
        sys.exit(1)

    try:
        service = build('drive', 'v3', credentials=creds)
        logging.info("Google Drive service client created.")
    except Exception as e:
        logging.error(f"Failed to build Google Drive service: {e}")
        sys.exit(1)

    # --- Process Files from Source Folder ---
    # MODIFIED: Redacted SOURCE_FOLDER_ID from log
    logging.info(f"Scanning source folder ID: <REDACTED> for MP3 files to copy.")
    page_token = None
    files_processed_count = 0
    new_files_copied = False # Flag to track if any new files were copied

    last_processed_dt = None
    if last_processed_timestamp:
        try:
            last_processed_dt = datetime.datetime.fromisoformat(last_processed_timestamp.replace('Z', '+00:00'))
            logging.info(f"Will process files created after: {last_processed_dt.isoformat()}")
        except ValueError:
            logging.error(f"Invalid timestamp format in state file: {last_processed_timestamp}. Processing all files.")
            last_processed_timestamp = None

    while True:
        try:
            # MODIFIED: Redacted SOURCE_FOLDER_ID from query log/safety
            # Actual query uses the real SOURCE_FOLDER_ID
            query = f"'<REDACTED_SOURCE>' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
            actual_query = f"'{SOURCE_FOLDER_ID}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"

            response = service.files().list(
                q=actual_query, # Use actual query for API call
                spaces='drive',
                fields='nextPageToken, files(id, name, createdTime)', # Request fields needed
                orderBy='createdTime asc',
                pageToken=page_token
            ).execute()

            files = response.get('files', [])
            if not files and page_token is None:
                 logging.info("No files found in the source folder.")
                 break

            newly_copied_in_page = 0
            for file in files:
                source_file_id = file.get('id')
                source_file_name = file.get('name')
                created_time_str = file.get('createdTime')

                if not source_file_id or not source_file_name or not created_time_str:
                    # MODIFIED: Redacted potential ID in file object representation
                    logging.warning(f"Skipping file with missing data (Name: {file.get('name', 'N/A')}, ID: <REDACTED>)")
                    continue

                # ===============================================
                # ===   CHECK IF THE FILE IS AN MP3 FILE      ===
                # ===============================================
                if not source_file_name.lower().endswith(".mp3"):
                    logging.debug(f"Skipping non-MP3 file: '{source_file_name}'")
                    continue # Skip to the next file in the loop
                # ===============================================
                # === END MP3 Check                             ===
                # ===============================================

                # --- Continue processing only if it's an MP3 ---
                try:
                    current_file_dt = datetime.datetime.fromisoformat(created_time_str.replace('Z', '+00:00'))
                except ValueError:
                    # MODIFIED: Redacted source_file_id from error log
                    logging.error(f"Invalid createdTime format for file '{source_file_name}' (ID: <REDACTED>): {created_time_str}. Skipping.")
                    continue

                # --- Check if file is newer than the last processed ---
                if last_processed_dt and current_file_dt <= last_processed_dt:
                    logging.debug(f"Skipping already processed MP3 file: '{source_file_name}' (Created: {created_time_str})") # No ID here originally
                    continue

                # MODIFIED: Redacted source_file_id from log
                logging.info(f"Processing new MP3 file to copy: '{source_file_name}' (ID: <REDACTED>, Created: {created_time_str})")

                # 1. Determine Hebrew Date Folder Name (cleaned)
                hebrew_folder_name = convert_rfc3339_to_hebrew_month_year(created_time_str)
                if hebrew_folder_name == "תאריך לא זמין" or "(Fallback" in hebrew_folder_name:
                     logging.warning(f"Using fallback folder name '{hebrew_folder_name}' for file '{source_file_name}' due to date conversion issue.")
                     # Consider if you want to skip instead:
                     # logging.error(f"Skipping file '{source_file_name}' due to failed Hebrew date conversion.")
                     # continue

                try:
                    # 2. Get or Create Target Hebrew Date Folder
                    target_hebrew_folder_id = get_or_create_folder(service, hebrew_folder_name, TARGET_BASE_FOLDER_ID)

                    # 3. Copy the file (keeping original name)
                    copied_file_id = copy_file(service, source_file_id, target_hebrew_folder_id, new_filename=source_file_name)

                    if copied_file_id:
                        new_files_copied = True
                        # 4. Record in CSV and update state
                        song_name_cleaned = Path(source_file_name).stem
                        singer_name = "סינגלים חדשים" # Default singer

                        append_song_to_csv(next_serial, song_name_cleaned, hebrew_folder_name, singer_name, copied_file_id)

                        # Update state *only after successful copy and record*
                        state["last_processed_timestamp"] = created_time_str
                        state["next_serial"] += 1
                        save_state(state)

                        files_processed_count += 1
                        newly_copied_in_page += 1
                        next_serial = state["next_serial"]
                        last_processed_dt = current_file_dt
                    else:
                         # MODIFIED: Redacted source_file_id from error log
                        logging.error(f"Failed to copy MP3 file '{source_file_name}' (ID: <REDACTED>). Skipping CSV/state update.")

                except Exception as e:
                    # Catch errors during folder creation or copy process
                    # MODIFIED: Redacted source_file_id from error log
                    logging.error(f"Error processing MP3 file '{source_file_name}' (ID: <REDACTED>): {e}", exc_info=True)

            # --- Pagination ---
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                logging.info("Reached end of file listing in source folder.")
                break
            logging.info(f"Processed {newly_copied_in_page} MP3 files from this page. Requesting next page...")
            time.sleep(1) # Small delay

        except HttpError as error:
            logging.error(f"An API error occurred during file listing: {error}")
            if error.resp.status == 403:
                 logging.error("Permission denied accessing source folder listing.")
            elif error.resp.status == 404:
                 # MODIFIED: Redacted SOURCE_FOLDER_ID from error log
                 logging.error(f"Source folder ID <REDACTED> not found.")
            break
        except Exception as e:
            logging.error(f"An unexpected error occurred during file listing/processing loop: {e}", exc_info=True)
            break

    if new_files_copied:
        logging.info(f"Finished processing. Total new MP3 files copied and recorded: {files_processed_count}")
    else:
        logging.info("No new MP3 files found to copy in this run.")

    logging.info("--- Drive Folder Copy Script End ---")
if __name__ == "__main__":
    main()
# --- END OF FILE process_drive_folder.py ---