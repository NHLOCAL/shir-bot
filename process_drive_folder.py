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
STATE_FILE = SCRIPT_DIR / "drive_state.json" # New state file name
CSV_FILE = SCRIPT_DIR / "new-songs.csv"      # New CSV file name
TOKEN_FILE = SCRIPT_DIR / "token.json"       # Reused for target drive authentication
CLIENT_SECRET_FILE = GDRIVE_SETUP_DIR / 'client_secret_auth.json' # For target drive auth setup

# --- Google Drive IDs ---
# !!! IMPORTANT: User needs to ensure the service account/user running this script
# !!! has at least VIEWER access to the SOURCE_FOLDER_ID and EDITOR access to the TARGET_BASE_FOLDER_ID.
SOURCE_FOLDER_ID = "16C0em4CCbg0UX0mKCwqVY9WsgRaz_1TB" # Public source folder
TARGET_BASE_FOLDER_ID = "1Rh2QafUuSjb4inShuqXwpHmh_V5HlJac" # Private target base folder (replace if different)

# --- Google API ---
SCOPES = ['https://www.googleapis.com/auth/drive'] # Need full drive scope for moving files (update)

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def load_state():
    """Loads the last processed timestamp and next serial number from state file."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            # Provide defaults if keys are missing
            state.setdefault("last_processed_timestamp", None) # Use None to indicate never run before
            state.setdefault("next_serial", 1) # Start serials from 1 or another base
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
        # Don't log every save if saving frequently, maybe only on change?
        # logging.info(f"State saved to {STATE_FILE}")
    except Exception as e:
        logging.error(f"Failed to save state to {STATE_FILE}: {e}")


def write_csv_header_if_needed():
    """Writes the CSV header if the file doesn't exist or is empty."""
    if not CSV_FILE.exists() or os.path.getsize(CSV_FILE) == 0:
        try:
            with open(CSV_FILE, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.writer(csvfile)
                # Updated columns based on new logic
                writer.writerow(["Serial Number", "Song Name", "Hebrew Date Folder", "Singer", "Drive ID"])
            logging.info(f"Created CSV header in {CSV_FILE}")
        except Exception as e:
            logging.error(f"Failed to write CSV header to {CSV_FILE}: {e}")

def append_song_to_csv(serial, song_name, hebrew_folder, singer, drive_id):
    """Appends a processed song's details to the CSV file."""
    try:
        with open(CSV_FILE, "a", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([serial, song_name, hebrew_folder, singer, drive_id])
        logging.info(f"Appended song Serial {serial} ('{song_name}') to {CSV_FILE}")
    except Exception as e:
        logging.error(f"Failed to append song {serial} to {CSV_FILE}: {e}")


def convert_rfc3339_to_hebrew_month_year(rfc3339_str):
    """Converts an RFC 3339 timestamp string (from Drive API) to a Hebrew Month Year string."""
    try:
        # Handle potential timezone offsets, convert to UTC naive datetime object
        # Google Drive API typically provides UTC time ('Z' suffix)
        if rfc3339_str.endswith('Z'):
            rfc3339_str = rfc3339_str[:-1] + '+00:00'

        dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
        dt_utc_naive = dt_aware.astimezone(datetime.timezone.utc).replace(tzinfo=None)

        g_date = dt_utc_naive.date()
        heb_date = dates.GregorianDate(g_date.year, g_date.month, g_date.day).to_heb()
        return f"{hebrewcal.Month(heb_date.year, heb_date.month).hebrew_month_name()} {heb_date.hebrew_year_str()}"
    except Exception as e:
        logging.error(f"Error converting timestamp '{rfc3339_str}' to Hebrew date: {e}")
        # Fallback: use Gregorian year-month if conversion fails
        try:
            dt_aware = datetime.datetime.fromisoformat(rfc3339_str)
            return dt_aware.strftime("%Y-%m") + " (Fallback)"
        except:
             return "תאריך לא זמין" # Absolute fallback


def authenticate():
    """Authenticates the user for accessing the TARGET Google Drive.
       Uses GitHub Secrets first, then local files."""
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
                    # Try console flow first, fall back to local server
                    try:
                        creds = flow.run_console()
                    except Exception: # Catch broad exceptions if console fails
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
                logging.error(f"Cannot authenticate: {CLIENT_SECRET_FILE} not found and no valid {TOKEN_FILE} or env var.")
                return None

    if creds and creds.valid:
        logging.info("Authentication successful.")
        return creds
    else:
        logging.error("Authentication failed.")
        return None


def get_or_create_folder(service, folder_name, parent_folder_id):
    """Gets the ID of a folder by name within a parent, creates it if it doesn't exist."""
    # Sanitize folder name for Drive API query
    sanitized_name = folder_name.replace("'", "\\'")
    query = f"name='{sanitized_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    try:
        response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = response.get('files', [])

        if files:
            folder_id = files[0]['id']
            logging.debug(f"Found existing folder: '{folder_name}' with ID: {folder_id} in parent {parent_folder_id}")
            return folder_id
        else:
            logging.info(f"Folder '{folder_name}' not found in parent {parent_folder_id}. Creating it.")
            file_metadata = {
                'name': folder_name, # Use original name for creation
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            # Ensure sufficient permissions before attempting create
            folder = service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            logging.info(f"Created folder: '{folder_name}' with ID: {folder_id} in parent {parent_folder_id}")
            return folder_id
    except HttpError as error:
        logging.error(f"An API error occurred while finding/creating folder '{folder_name}': {error}")
        # Check for specific permission errors if possible
        if error.resp.status == 403:
            logging.error("Permission denied. Ensure the authenticated user/service account has sufficient permissions for the target folder.")
        raise # Re-raise to stop processing if folder handling fails critically
    except Exception as e:
        logging.error(f"An unexpected error occurred finding/creating folder '{folder_name}': {e}")
        raise


def move_file(service, file_id, file_name, source_folder_id, target_folder_id):
    """Moves a file from the source folder to the target folder."""
    logging.info(f"Attempting to move file '{file_name}' (ID: {file_id}) from {source_folder_id} to {target_folder_id}")
    try:
        # Retrieve the file's existing parents to ensure source_folder_id is among them
        file_metadata = service.files().get(fileId=file_id, fields='parents').execute()
        previous_parents = ",".join(file_metadata.get('parents'))

        # Use update method to change parents
        updated_file = service.files().update(
            fileId=file_id,
            addParents=target_folder_id,
            removeParents=source_folder_id,
            fields='id, parents' # Request parents back to confirm
        ).execute()

        logging.info(f"Successfully moved file '{file_name}' (ID: {file_id}) to folder {target_folder_id}.")
        return True
    except HttpError as error:
        logging.error(f"API error moving file '{file_name}' (ID: {file_id}): {error}")
        # Log specific permission issues
        if error.resp.status == 403:
             logging.error("Permission denied. Check permissions on BOTH source and target folders.")
        elif error.resp.status == 404:
             logging.error("File or one of the folders not found.")
        # If the error suggests the file is already moved (e.g., source parent not found), log but maybe continue?
        # This requires more specific error parsing which can be complex.
        return False
    except Exception as e:
        logging.error(f"Unexpected error moving file '{file_name}' (ID: {file_id}): {e}")
        return False

# --- Main Processing Function ---

def main():
    logging.info("--- Drive Folder Processing Script Start ---")
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
    logging.info(f"Scanning source folder ID: {SOURCE_FOLDER_ID}")
    page_token = None
    files_processed_count = 0
    new_files_found = False # Flag to track if any new files were processed in this run

    # Convert last processed timestamp string to datetime object for comparison, if it exists
    last_processed_dt = None
    if last_processed_timestamp:
        try:
            last_processed_dt = datetime.datetime.fromisoformat(last_processed_timestamp.replace('Z', '+00:00'))
            logging.info(f"Will process files created after: {last_processed_dt}")
        except ValueError:
            logging.error(f"Invalid timestamp format in state file: {last_processed_timestamp}. Processing all files.")
            last_processed_timestamp = None # Reset to process all

    while True:
        try:
            # List files directly in the source folder, ordered by creation time ascending
            # Ensure we only get files, not folders
            query = f"'{SOURCE_FOLDER_ID}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false"
            response = service.files().list(
                q=query,
                spaces='drive',
                fields='nextPageToken, files(id, name, createdTime, modifiedTime)', # Get createdTime
                orderBy='createdTime asc', # Process oldest first
                pageToken=page_token
            ).execute()

            files = response.get('files', [])
            if not files:
                logging.info("No files found in the source folder (or page).")

            newly_processed_in_page = 0
            for file in files:
                file_id = file.get('id')
                file_name = file.get('name')
                created_time_str = file.get('createdTime') # RFC 3339 format (e.g., "2023-10-27T10:00:00.000Z")

                if not file_id or not file_name or not created_time_str:
                    logging.warning(f"Skipping file with missing data: {file}")
                    continue

                # Convert current file's created time to datetime for comparison
                try:
                    current_file_dt = datetime.datetime.fromisoformat(created_time_str.replace('Z', '+00:00'))
                except ValueError:
                    logging.error(f"Invalid createdTime format for file '{file_name}' (ID: {file_id}): {created_time_str}. Skipping.")
                    continue

                # --- Check if file is newer than the last processed ---
                if last_processed_dt and current_file_dt <= last_processed_dt:
                    # This file was created at or before the last processed one, skip it
                    logging.debug(f"Skipping already processed file: '{file_name}' (Created: {created_time_str})")
                    continue

                logging.info(f"Processing new file: '{file_name}' (ID: {file_id}, Created: {created_time_str})")
                new_files_found = True

                # 1. Determine Hebrew Date Folder Name
                hebrew_folder_name = convert_rfc3339_to_hebrew_month_year(created_time_str)

                try:
                    # 2. Get or Create Target Hebrew Date Folder in the TARGET base folder
                    target_hebrew_folder_id = get_or_create_folder(service, hebrew_folder_name, TARGET_BASE_FOLDER_ID)

                    # 3. Move the file
                    if move_file(service, file_id, file_name, SOURCE_FOLDER_ID, target_hebrew_folder_id):
                        # 4. Record in CSV and update state (only if move was successful)
                        song_name_cleaned = Path(file_name).stem # Basic name cleaning
                        singer_name = "שירים מהדרייב" # Default singer, adjust if needed

                        append_song_to_csv(next_serial, song_name_cleaned, hebrew_folder_name, singer_name, file_id)

                        # Update state *only after successful processing*
                        state["last_processed_timestamp"] = created_time_str # Store the exact timestamp string from API
                        state["next_serial"] += 1
                        save_state(state) # Save state after each successful file

                        files_processed_count += 1
                        newly_processed_in_page += 1
                        next_serial = state["next_serial"] # Keep local variable in sync
                        last_processed_dt = current_file_dt # Update comparison timestamp
                    else:
                        logging.error(f"Failed to move file '{file_name}'. Skipping CSV/state update for this file.")
                        # Consider whether to stop the whole process or just skip the file. Skipping for now.

                except Exception as e:
                    # Catch errors from get/create folder or other unexpected issues
                    logging.error(f"Error processing file '{file_name}' (ID: {file_id}): {e}. Skipping.")
                    # Decide if script should halt on such errors. Continuing for now.

            # --- Pagination ---
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                logging.info("Reached end of file listing.")
                break # Exit the while loop

            logging.info(f"Processed {newly_processed_in_page} files from this page. Requesting next page...")
            time.sleep(1) # Small delay before fetching next page

        except HttpError as error:
            logging.error(f"An API error occurred during file listing: {error}")
            if error.resp.status == 403:
                 logging.error("Permission denied accessing source folder. Ensure the authenticated user/service account has at least VIEWER rights.")
            elif error.resp.status == 404:
                 logging.error(f"Source folder ID {SOURCE_FOLDER_ID} not found.")
            # Decide how to handle API errors - retry, stop, etc. Stopping for now.
            break
        except Exception as e:
            logging.error(f"An unexpected error occurred during file listing/processing loop: {e}")
            break # Stop on unexpected errors

    if new_files_found:
        logging.info(f"Finished processing. Total new files moved and recorded: {files_processed_count}")
    else:
        logging.info("No new files found to process in this run.")

    # Final state save (might be redundant if saved after each file, but safe)
    # save_state(state)
    logging.info("--- Drive Folder Processing Script End ---")

if __name__ == "__main__":
    main()

# --- END OF FILE process_drive_folder.py ---