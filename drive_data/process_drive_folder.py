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

# Certificate handling
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()

# --- Configuration & Constants ---
# SCRIPT_DIR points to the 'drive_data' directory where this script resides
SCRIPT_DIR = Path(__file__).parent.resolve()

# All data files are relative to SCRIPT_DIR (i.e., inside 'drive_data')
STATE_FILE = SCRIPT_DIR / "drive_state.json"
CSV_FILE = SCRIPT_DIR / "new-songs.csv"
TOKEN_FILE = SCRIPT_DIR / "token.json"
# Assumes client_secret_auth.json is also inside 'drive_data'
CLIENT_SECRET_FILE = SCRIPT_DIR / 'client_secret_auth.json'

# --- Google Drive IDs ---
SOURCE_FOLDER_ID = "16C0em4CCbg0UX0mKCwqVY9WsgRaz_1TB" # Public source folder
TARGET_BASE_FOLDER_ID = "1Rh2QafUuSjb4inShuqXwpHmh_V5HlJac" # Private target base folder

# --- Google API ---
SCOPES = ['https://www.googleapis.com/auth/drive']

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def ensure_script_dir_exists():
    """Ensures the script's directory exists (mainly for robustness)."""
    # Since the script runs from here, it should exist, but this is a safety check.
    try:
        SCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        logging.error(f"Could not ensure script directory {SCRIPT_DIR} exists: {e}")
        # Consider if this failure is critical

def load_state():
    """Loads the last processed timestamp and next serial number from state file."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            state.setdefault("last_processed_timestamp", None)
            state.setdefault("next_serial", 1)
            logging.info(f"Loaded state from {STATE_FILE}: Last timestamp={state['last_processed_timestamp']}, Next serial={state['next_serial']}")
            return state
        except json.JSONDecodeError:
            logging.error(f"Error decoding JSON from {STATE_FILE}. Starting fresh.")
            return {"last_processed_timestamp": None, "next_serial": 1}
    else:
        logging.info(f"{STATE_FILE} not found. Starting fresh.")
        return {"last_processed_timestamp": None, "next_serial": 1}

def save_state(state):
    """Saves the current state (timestamp, serial) to the state file."""
    ensure_script_dir_exists() # Check directory before writing
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=4)
        # logging.info(f"State saved to {STATE_FILE}")
    except Exception as e:
        logging.error(f"Failed to save state to {STATE_FILE}: {e}")

def write_csv_header_if_needed():
    """Writes the CSV header if the file doesn't exist or is empty."""
    ensure_script_dir_exists() # Check directory before writing
    if not CSV_FILE.exists() or CSV_FILE.stat().st_size == 0:
        try:
            with open(CSV_FILE, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(["Serial Number", "Song Name", "Hebrew Date Folder", "Singer", "Copied Drive ID"])
            logging.info(f"Created CSV header in {CSV_FILE}")
        except Exception as e:
            logging.error(f"Failed to write CSV header to {CSV_FILE}: {e}")

def append_song_to_csv(serial, song_name, hebrew_folder, singer, copied_drive_id):
    """Appends a processed song's details to the CSV file."""
    ensure_script_dir_exists() # Check directory before writing
    try:
        with open(CSV_FILE, "a", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([serial, song_name, hebrew_folder, singer, copied_drive_id])
        logging.info(f"Appended song Serial {serial} ('{song_name}') to {CSV_FILE} (Copied ID: <REDACTED>)")
    except Exception as e:
        logging.error(f"Failed to append song {serial} to {CSV_FILE}: {e}")

def convert_rfc3339_to_hebrew_month_year(rfc3339_str):
    """
    Converts an RFC 3339 timestamp string to a cleaned Hebrew Month Year string.
    """
    try:
        if rfc3339_str.endswith('Z'):
            rfc3339_str = rfc3339_str[:-1] + '+00:00'
        dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
        dt_utc_naive = dt_aware.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        g_date = dt_utc_naive.date()
        heb_date = dates.GregorianDate(g_date.year, g_date.month, g_date.day).to_heb()

        heb_month_name = hebrewcal.Month(heb_date.year, heb_date.month).month_name(True)
        full_heb_string = heb_date.hebrew_date_string(True)
        parts = full_heb_string.split()
        heb_year_str_raw = parts[-1] if parts else str(heb_date.year)

        cleaned_year_str = heb_year_str_raw
        if cleaned_year_str.startswith("ה׳"):
            cleaned_year_str = cleaned_year_str[2:]
        cleaned_year_str = cleaned_year_str.replace("׳", "").replace("״", "")

        folder_name = f"{heb_month_name} {cleaned_year_str}"
        logging.debug(f"Generated folder name: '{folder_name}' from raw date '{rfc3339_str}'")
        return folder_name

    except ImportError:
        logging.error("pyluach library not found. Install it using 'pip install pyluach'.")
        try:
            dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
            return dt_aware.strftime("%Y-%m") + " (Fallback - pyluach missing)"
        except:
             return "תאריך לא זמין"
    except Exception as e:
        logging.error(f"Error converting timestamp '{rfc3339_str}' to Hebrew date: {e}", exc_info=True)
        try:
            dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
            return dt_aware.strftime("%Y-%m") + " (Fallback - conversion error)"
        except:
             return "תאריך לא זמין"

def authenticate():
    """Authenticates the user for accessing the TARGET Google Drive."""
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')

    # --- GitHub Actions Authentication (via Environment Variable) ---
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
                    creds = None # Force re-auth or failure if refresh fails
            if creds and creds.valid:
                logging.info("Successfully authenticated using environment variable.")
                return creds
            else:
                logging.warning("Credentials from environment variable invalid or expired.")
        except Exception as e:
            logging.error(f"Error authenticating via environment variable: {e}")
        creds = None # Ensure creds is None if env var method failed

    # --- Local Authentication (using token.json in script dir) ---
    if not creds: # Only try local if env var method failed or wasn't used
        logging.info(f"Attempting authentication using local token file: {TOKEN_FILE}")
        if TOKEN_FILE.exists():
            try:
                creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
            except Exception as e:
                logging.error(f"Error loading credentials from {TOKEN_FILE}: {e}")
                creds = None

    # --- Refresh or Re-authenticate Flow ---
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logging.info(f"Refreshing credentials from local {TOKEN_FILE}.")
            try:
                creds.refresh(Request())
            except Exception as e:
                logging.error(f"Failed to refresh token from {TOKEN_FILE}: {e}. Manual re-auth likely needed.")
                creds = None # Force re-auth below if refresh fails

        # If still no valid creds, try the interactive flow (requires client_secret)
        if not creds or not creds.valid:
            if CLIENT_SECRET_FILE.exists():
                logging.info(f"No valid credentials. Starting auth flow using {CLIENT_SECRET_FILE}.")
                if 'GITHUB_ACTIONS' in os.environ and not token_json_content:
                     # Avoid interactive flow in Actions if secret wasn't provided initially
                     logging.error("Cannot run interactive auth flow in GitHub Actions without GDRIVE_TOKEN_JSON_CONTENT.")
                     return None
                try:
                    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_FILE), SCOPES)
                    # Prefer console flow, fall back to local server
                    try:
                        creds = flow.run_console()
                    except Exception:
                        logging.warning("Console flow failed, trying local server.")
                        creds = flow.run_local_server(port=0)

                    # Save the credentials for the next run
                    if creds:
                        ensure_script_dir_exists() # Check directory before writing
                        try:
                            with open(TOKEN_FILE, 'w') as token:
                                token.write(creds.to_json())
                            logging.info(f"Credentials saved to {TOKEN_FILE}")
                        except Exception as e:
                            logging.error(f"Failed to save credentials to {TOKEN_FILE}: {e}")
                    else:
                        logging.error("Authentication flow did not return credentials.")
                        return None
                except Exception as e:
                    logging.error(f"Authentication flow failed: {e}")
                    return None
            else:
                logging.error(f"Cannot authenticate: Client secret file ({CLIENT_SECRET_FILE}) not found, and no valid token file or env var provided.")
                return None

    # --- Final Check ---
    if creds and creds.valid:
        logging.info("Authentication successful.")
        return creds
    else:
        logging.error("Authentication failed.")
        return None

def get_or_create_folder(service, folder_name, parent_folder_id):
    """Gets the ID of a folder by name within a parent, creates it if it doesn't exist."""
    sanitized_name = folder_name.replace("'", "\\'")
    # Query uses the actual parent_folder_id, but logging redacts it
    actual_query = f"name='{sanitized_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

    try:
        response = service.files().list(q=actual_query, spaces='drive', fields='files(id, name)').execute()
        files = response.get('files', [])

        if files:
            folder_id = files[0]['id']
            logging.debug(f"Found existing folder: '{folder_name}' (ID: <REDACTED>) in parent <REDACTED>")
            return folder_id
        else:
            logging.info(f"Folder '{folder_name}' not found in parent <REDACTED>. Creating it.")
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            folder = service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            logging.info(f"Created folder: '{folder_name}' (ID: <REDACTED>) in parent <REDACTED>")
            return folder_id
    except HttpError as error:
        logging.error(f"API error finding/creating folder '{folder_name}' in parent <REDACTED>: {error}")
        if error.resp.status == 403:
            logging.error("Permission denied. Check editor permissions on the target base folder.")
        raise
    except Exception as e:
        logging.error(f"Unexpected error finding/creating folder '{folder_name}' in parent <REDACTED>: {e}")
        raise

def copy_file(service, source_file_id, target_folder_id, new_filename=None):
    """Copies a file to the target folder. Returns the ID of the new copy."""
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
        logging.info(f"Successfully copied file as '{copied_file_name}' (New ID: <REDACTED>) to folder <REDACTED>.")
        return copied_file_id
    except HttpError as error:
        logging.error(f"API error copying file ID <REDACTED>: {error}")
        if error.resp.status == 403:
             logging.error("Permission denied. Check permissions on target folder or source file.")
        elif error.resp.status == 404:
             logging.error("Source file or target folder not found.")
        return None
    except Exception as e:
        logging.error(f"Unexpected error copying file ID <REDACTED>: {e}")
        return None

# --- Main Processing Function ---

def main():
    logging.info("--- Drive Folder Copy Script Start ---")
    ensure_script_dir_exists() # Basic check

    state = load_state()
    last_processed_timestamp = state.get("last_processed_timestamp")
    next_serial = state.get("next_serial")

    write_csv_header_if_needed()

    # --- Authenticate ---
    creds = authenticate()
    if not creds:
        logging.error("Authentication failed. Exiting.")
        sys.exit(1) # Exit if authentication fails

    try:
        service = build('drive', 'v3', credentials=creds)
        logging.info("Google Drive service client created.")
    except Exception as e:
        logging.error(f"Failed to build Google Drive service: {e}")
        sys.exit(1) # Exit if service build fails

    # --- Process Files ---
    logging.info(f"Scanning source folder ID: <REDACTED> for new MP3 files.")
    page_token = None
    files_processed_count = 0
    new_files_copied = False

    last_processed_dt = None
    if last_processed_timestamp:
        try:
            # Ensure timestamp is timezone-aware for comparison
            last_processed_dt = datetime.datetime.fromisoformat(last_processed_timestamp.replace('Z', '+00:00'))
            logging.info(f"Will process files created after: {last_processed_dt.isoformat()}")
        except ValueError:
            logging.error(f"Invalid timestamp format in state file: {last_processed_timestamp}. Processing all files.")
            last_processed_timestamp = None # Reset to process all

    while True: # Loop through pages of files
        try:
            # Query uses the actual SOURCE_FOLDER_ID, but logging redacts it
            actual_query = f"'{SOURCE_FOLDER_ID}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
            response = service.files().list(
                q=actual_query,
                spaces='drive',
                fields='nextPageToken, files(id, name, createdTime)',
                orderBy='createdTime asc', # Process oldest first
                pageToken=page_token
            ).execute()

            files = response.get('files', [])
            if not files and page_token is None:
                 logging.info("No files found in the source folder.")
                 break # Exit loop if no files on first page

            newly_copied_in_page = 0
            for file in files:
                source_file_id = file.get('id')
                source_file_name = file.get('name')
                created_time_str = file.get('createdTime')

                if not all([source_file_id, source_file_name, created_time_str]):
                    logging.warning(f"Skipping file with missing data (Name: {file.get('name', 'N/A')}, ID: <REDACTED>)")
                    continue

                # Filter for MP3 files only
                if not source_file_name.lower().endswith(".mp3"):
                    logging.debug(f"Skipping non-MP3 file: '{source_file_name}'")
                    continue

                # Parse current file timestamp
                try:
                    current_file_dt = datetime.datetime.fromisoformat(created_time_str.replace('Z', '+00:00'))
                except ValueError:
                    logging.error(f"Invalid createdTime format for MP3 file '{source_file_name}' (ID: <REDACTED>): {created_time_str}. Skipping.")
                    continue

                # Check if file is newer than the last processed one
                if last_processed_dt and current_file_dt <= last_processed_dt:
                    logging.debug(f"Skipping already processed MP3 file: '{source_file_name}' (Created: {created_time_str})")
                    continue

                # --- Process this new MP3 file ---
                logging.info(f"Processing new MP3 file: '{source_file_name}' (ID: <REDACTED>, Created: {created_time_str})")

                # 1. Get Hebrew Date Folder Name
                hebrew_folder_name = convert_rfc3339_to_hebrew_month_year(created_time_str)
                if hebrew_folder_name == "תאריך לא זמין" or "(Fallback" in hebrew_folder_name:
                     logging.warning(f"Using fallback folder name '{hebrew_folder_name}' for file '{source_file_name}'.")
                     # Decide if fallback is acceptable or if the file should be skipped

                try:
                    # 2. Get or Create Target Folder
                    target_hebrew_folder_id = get_or_create_folder(service, hebrew_folder_name, TARGET_BASE_FOLDER_ID)

                    # 3. Copy File
                    copied_file_id = copy_file(service, source_file_id, target_hebrew_folder_id, new_filename=source_file_name)

                    if copied_file_id:
                        # 4. Record Success
                        new_files_copied = True
                        song_name_cleaned = Path(source_file_name).stem
                        singer_name = "סינגלים חדשים" # Default singer name

                        append_song_to_csv(next_serial, song_name_cleaned, hebrew_folder_name, singer_name, copied_file_id)

                        # Update state ONLY after successful copy and record
                        state["last_processed_timestamp"] = created_time_str # Use the precise timestamp string from API
                        state["next_serial"] += 1
                        save_state(state) # Save state immediately

                        # Update tracking variables for this run
                        files_processed_count += 1
                        newly_copied_in_page += 1
                        next_serial = state["next_serial"] # Get the updated serial
                        last_processed_dt = current_file_dt # Update the latest processed time for this run

                    else:
                        logging.error(f"Failed to copy MP3 file '{source_file_name}' (ID: <REDACTED>). Will retry on next run if applicable.")
                        # NOTE: Because state isn't updated, this file will be re-attempted next time.

                except Exception as e:
                    # Catch errors during folder creation or the copy attempt itself
                    logging.error(f"Error processing MP3 file '{source_file_name}' (ID: <REDACTED>): {e}", exc_info=True)
                    # Continue to the next file, this one will be retried next run

            # --- Pagination ---
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                logging.info("Reached end of file listing in source folder.")
                break # Exit the 'while True' loop
            else:
                 logging.info(f"Processed {newly_copied_in_page} new MP3 files from this page. Requesting next page...")
                 time.sleep(1) # Brief pause before next page request

        except HttpError as error:
            logging.error(f"An API error occurred during file listing/processing loop: {error}")
            if error.resp.status == 403:
                 logging.error("Permission denied accessing source folder listing. Check source folder sharing.")
            elif error.resp.status == 404:
                 logging.error(f"Source folder ID <REDACTED> not found.")
            # Decide whether to break or maybe retry after a delay
            break # Exit loop on API errors during listing
        except Exception as e:
            logging.error(f"An unexpected error occurred during file listing/processing loop: {e}", exc_info=True)
            break # Exit loop on other unexpected errors

    # --- End of Run Summary ---
    if new_files_copied:
        logging.info(f"Finished processing. Total new MP3 files copied and recorded in this run: {files_processed_count}")
    else:
        logging.info("No new MP3 files found to copy in this run.")

    logging.info("--- Drive Folder Copy Script End ---")

if __name__ == "__main__":
    main()
# --- END OF FILE drive_data/process_drive_folder.py ---