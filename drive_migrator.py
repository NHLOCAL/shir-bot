import os
import csv
import datetime
import json
import logging
import time
from pathlib import Path
import re # Import re for sanitizing folder names

# Import Google libraries
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Import pyluach for Hebrew date conversion
from pyluach import dates, hebrewcal

# --- Configuration & Constants ---
SCRIPT_DIR = Path(__file__).parent.resolve()
# --- Source Folder (Public - API access still needed) ---
SOURCE_FOLDER_ID = "16C0em4CCbg0UX0mKCwqVY9WsgRaz_1TB"
# --- Target Folder (Private - Requires OAuth) ---
TARGET_BASE_FOLDER_ID = "1Rh2QafUuSjb4inShuqXwpHmh_V5HlJac"
# --- Authentication/State Files ---
TOKEN_FILE = SCRIPT_DIR / "token.json"
CLIENT_SECRET_FILE = SCRIPT_DIR / 'client_secret_auth.json' # Needed for initial auth/refresh
# --- New State File ---
MIGRATOR_STATE_FILE = SCRIPT_DIR / "migrator_state.json"
# --- Output CSV ---
NEW_CSV_FILE = SCRIPT_DIR / "new-songs.csv"
# --- Google API ---
SCOPES = ['https://www.googleapis.com/auth/drive'] # Full scope needed for moving files
SERIAL_START_NUMBER = 1 # Default if CSV is empty
RFC3339_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ" # Example: 2023-10-27T10:00:00.000Z

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Helper Functions ---

def load_migrator_state():
    """Loads the last processed timestamp from the state file."""
    if MIGRATOR_STATE_FILE.exists():
        try:
            with open(MIGRATOR_STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            last_timestamp = state.get("last_processed_timestamp")
            if last_timestamp:
                # Validate format (basic check)
                try:
                    # Attempt parsing to ensure it's a valid ISO-like format Drive API expects
                    datetime.datetime.fromisoformat(last_timestamp.replace('Z', '+00:00'))
                    logging.info(f"Loaded last processed timestamp: {last_timestamp}")
                    return last_timestamp
                except ValueError:
                    logging.warning(f"Invalid timestamp format found in {MIGRATOR_STATE_FILE}: {last_timestamp}. Ignoring.")
                    return None
            else:
                 logging.info(f"{MIGRATOR_STATE_FILE} found but no timestamp present. Starting fresh.")
                 return None
        except json.JSONDecodeError:
            logging.error(f"Error decoding JSON from {MIGRATOR_STATE_FILE}. Starting fresh.")
            return None
    else:
        logging.info(f"{MIGRATOR_STATE_FILE} not found. Starting fresh.")
        return None

def save_migrator_state(last_processed_timestamp):
    """Saves the last processed timestamp to the state file."""
    if not last_processed_timestamp:
        logging.warning("Attempted to save state with no timestamp. Skipping save.")
        return
    try:
        state_data = {"last_processed_timestamp": last_processed_timestamp}
        with open(MIGRATOR_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state_data, f, ensure_ascii=False, indent=4)
        logging.info(f"State saved: last processed timestamp set to {last_processed_timestamp}")
    except Exception as e:
        logging.error(f"Failed to save state to {MIGRATOR_STATE_FILE}: {e}")


def authenticate():
    """Authenticates the user using GitHub Secrets first, then local files."""
    # (Code identical to the previous version - kept for brevity)
    creds = None
    token_json_content = os.environ.get('GDRIVE_TOKEN_JSON_CONTENT')

    # --- GitHub Actions Authentication (using environment variable) ---
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
                logging.warning("Credentials from environment variable are invalid or expired and could not be refreshed.")
                creds = None
        except json.JSONDecodeError as e:
            logging.error(f"Could not decode JSON from GDRIVE_TOKEN_JSON_CONTENT environment variable: {e}")
            creds = None
        except Exception as e:
            logging.error(f"Error authenticating via environment variable: {e}")
            creds = None

    # --- Local Authentication (using token.json file) ---
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
                 logging.error(f"Failed to refresh token from {TOKEN_FILE}: {e}. Manual re-authentication might be needed.")
                 creds = None

        if not creds or not creds.valid:
            if CLIENT_SECRET_FILE.exists():
                logging.info(f"No valid credentials found. Starting authentication flow using {CLIENT_SECRET_FILE}.")
                if 'GITHUB_ACTIONS' in os.environ and not token_json_content:
                    logging.error("Cannot run interactive auth flow in GitHub Actions. Ensure GDRIVE_TOKEN_JSON_CONTENT secret is set.")
                    return None
                try:
                    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_FILE), SCOPES)
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
                logging.error(f"Cannot authenticate: {CLIENT_SECRET_FILE} not found and no valid {TOKEN_FILE} or environment variable.")
                return None

    if creds and creds.valid:
        logging.info("Authentication successful.")
        return creds
    else:
        logging.error("Authentication failed.")
        return None


def convert_to_hebrew_month_year(greg_date_str):
    """Converts an ISO 8601 date string (like Drive's createdTime) to Hebrew month and year."""
    # (Code identical to the previous version - kept for brevity)
    try:
        # Handle potential 'Z' for UTC and milliseconds
        greg_date_str = greg_date_str.replace('Z', '+00:00')
        # Truncate milliseconds if present, as fromisoformat might struggle
        if '.' in greg_date_str:
             parts = greg_date_str.split('+')
             date_part = parts[0].split('.')[0]
             tz_part = parts[1] if len(parts) > 1 else '00:00' # Handle case without tz offset
             greg_date_str = f"{date_part}+{tz_part}"


        dt = datetime.datetime.fromisoformat(greg_date_str)
        # Convert to date object (timezone doesn't affect the date itself for this purpose)
        g_date = dt.date()
        heb_date = dates.GregorianDate(g_date.year, g_date.month, g_date.day).to_heb()
        # Use pyluach's built-in string formatting
        # Sanitize for folder name: remove potential problematic characters if any
        folder_name = f"{hebrewcal.Month(heb_date.year, heb_date.month).hebrew_month_name()} {heb_date.hebrew_year_str()}"
        # Basic sanitization: replace potential problematic characters for filenames/foldernames if needed
        folder_name = re.sub(r'[<>:"/\\|?*]', '_', folder_name) # Example: replace invalid chars with underscore
        folder_name = folder_name.strip('. ') # Remove leading/trailing dots or spaces
        return folder_name

    except Exception as e:
        logging.error(f"Error converting date '{greg_date_str}': {e}")
        # Fallback folder name if conversion fails
        return "תאריך_לא_ידוע"


def get_or_create_folder(service, folder_name, parent_folder_id):
    """Checks if a folder exists and returns its ID. Creates it if it doesn't exist."""
    # (Code identical to the previous version - kept for brevity)
    sanitized_name = folder_name.replace("'", "\\'") # Escape single quotes for query
    query = f"name='{sanitized_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    try:
        response = service.files().list(q=query,
                                        spaces='drive',
                                        fields='files(id, name)',
                                        corpora='user' # Important when searching specific parent
                                        ).execute()
        files = response.get('files', [])

        if files:
            folder_id = files[0]['id']
            logging.info(f"Found existing folder: '{folder_name}' with ID: {folder_id}")
            return folder_id
        else:
            logging.info(f"Folder '{folder_name}' not found. Creating it under parent {parent_folder_id}.")
            file_metadata = {
                'name': folder_name, # Use original (unsanitized for query) name for creation
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_folder_id]
            }
            folder = service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            logging.info(f"Created folder: '{folder_name}' with ID: {folder_id}")
            return folder_id
    except HttpError as error:
        logging.error(f"An API error occurred while finding/creating folder '{folder_name}': {error}")
        # Depending on the error, you might want to retry or raise
        raise # Re-raise the exception to stop the process if folder handling fails
    except Exception as e:
        logging.error(f"Unexpected error finding or creating folder '{folder_name}': {e}")
        raise


def move_file(service, file_id, file_name, source_folder_id, target_folder_id, retries=3, delay=5):
    """Moves a file from source_folder_id to target_folder_id with retries."""
    # (Code identical to the previous version - kept for brevity)
    logging.info(f"Attempting to move file '{file_name}' (ID: {file_id}) from {source_folder_id} to {target_folder_id}")

    for attempt in range(retries):
        try:
            # Retrieve the file's current parents to ensure correct removal
            file_metadata = service.files().get(fileId=file_id, fields='parents').execute()
            previous_parents = ",".join(file_metadata.get('parents'))

            # Update the file's parents: add target, remove source
            updated_file = service.files().update(
                fileId=file_id,
                addParents=target_folder_id,
                removeParents=source_folder_id, # Use specific source ID
                #removeParents=previous_parents, # Alternative: remove all previous parents
                fields='id, parents' # Request fields to confirm operation
            ).execute()

            logging.info(f"Successfully moved file '{file_name}' (ID: {file_id}). New parents: {updated_file.get('parents')}")
            return True # Indicate success

        except HttpError as error:
            logging.warning(f"Move attempt {attempt + 1}/{retries} failed for file '{file_name}' (ID: {file_id}): {error}")
            # Specific error checks could be added here (e.g., 404 Not Found, 403 Permission)
            if error.resp.status in [404]:
                 logging.error(f"File {file_id} not found. Skipping.")
                 return False # Don't retry if file doesn't exist
            if error.resp.status in [403]:
                 logging.error(f"Permission error moving file {file_id}. Check scopes and folder permissions.")
                 return False # Don't retry permission errors usually

        except Exception as e:
            logging.warning(f"Unexpected error during move attempt {attempt + 1}/{retries} for file '{file_name}' (ID: {file_id}): {e}")

        if attempt < retries - 1:
            logging.info(f"Retrying move in {delay} seconds...")
            time.sleep(delay)
        else:
            logging.error(f"Failed to move file '{file_name}' (ID: {file_id}) after {retries} retries.")
            return False # Indicate failure


def write_csv_header_if_needed(csv_path):
    """Writes the CSV header if the file doesn't exist or is empty."""
    # (Code identical to the previous version - kept for brevity)
    if not csv_path.exists() or os.path.getsize(csv_path) == 0:
        try:
            with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                writer = csv.writer(csvfile)
                # Matching the original script's header format
                writer.writerow(["Serial Number", "Song Name", "Album Name", "Singer", "Drive ID"])
            logging.info(f"Created CSV header in {csv_path}")
        except Exception as e:
            logging.error(f"Failed to write CSV header to {csv_path}: {e}")


def append_song_to_csv(csv_path, serial, song_name, album_name, singer, drive_id):
    """Appends a song's details to the CSV file."""
    # (Code identical to the previous version - kept for brevity)
    try:
        with open(csv_path, "a", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([serial, song_name, album_name, singer, drive_id])
        # logging.info(f"Appended song {serial} ('{song_name}') to {csv_path}") # Can be verbose
    except Exception as e:
        logging.error(f"Failed to append song {serial} ('{song_name}') to {csv_path}: {e}")


def get_next_serial(csv_path):
    """Reads the CSV to find the highest existing serial number and returns the next one."""
    # (Code identical to the previous version - kept for brevity)
    if not csv_path.exists() or os.path.getsize(csv_path) == 0:
        return SERIAL_START_NUMBER

    last_serial = 0
    try:
        with open(csv_path, "r", newline="", encoding="utf-8") as csvfile:
            reader = csv.reader(csvfile)
            header = next(reader, None) # Skip header
            if header is None:
                 return SERIAL_START_NUMBER # Empty file after header check

            for row in reader:
                try:
                    # Assuming serial is the first column (index 0)
                    if row: # Ensure row is not empty
                       current_serial = int(row[0])
                       if current_serial > last_serial:
                           last_serial = current_serial
                except (ValueError, IndexError):
                    # Log warning for malformed rows but continue
                    logging.warning(f"Skipping row due to invalid serial number format: {row}")
                    continue
        next_serial = last_serial + 1
        logging.info(f"Determined next serial number from CSV: {next_serial}")
        return next_serial

    except Exception as e:
        logging.error(f"Error reading serial numbers from {csv_path}: {e}. Starting from default {SERIAL_START_NUMBER}.")
        return SERIAL_START_NUMBER

# --- Main Processing Function ---

def main():
    logging.info("--- Drive Migrator Script Start ---")

    # 1. Authenticate
    creds = authenticate()
    if not creds:
        logging.error("Authentication failed. Exiting.")
        return

    try:
        service = build('drive', 'v3', credentials=creds)
        logging.info("Google Drive service client created.")
    except Exception as e:
        logging.error(f"Failed to build Google Drive service: {e}")
        return

    # 2. Load State & Prepare CSV
    last_processed_timestamp = load_migrator_state()
    write_csv_header_if_needed(NEW_CSV_FILE)
    next_serial = get_next_serial(NEW_CSV_FILE)

    # 3. Build Query for API
    query_parts = [
        f"'{SOURCE_FOLDER_ID}' in parents",
        "trashed=false"
        # IMPORTANT: Exclude folders directly in the query
        "mimeType != 'application/vnd.google-apps.folder'"
    ]
    if last_processed_timestamp:
        # Ensure the timestamp is properly quoted for the query
        query_parts.append(f"createdTime > '{last_processed_timestamp}'")
        logging.info(f"Querying for files created after: {last_processed_timestamp}")
    else:
        logging.info("Querying for all files (no previous timestamp found).")

    query = " and ".join(query_parts)

    # 4. List files in the source folder (paginated)
    page_token = None
    files_processed_count = 0
    files_moved_count = 0
    global_latest_processed_timestamp = last_processed_timestamp # Initialize with loaded value

    while True:
        try:
            logging.info(f"Fetching files using query: '{query}' (Page token: {page_token})...")
            response = service.files().list(
                q=query,
                # Specify fields needed + createdTime is essential now
                fields="nextPageToken, files(id, name, mimeType, createdTime)",
                orderBy="createdTime asc", # Order by creation time ascending
                spaces='drive',
                pageToken=page_token,
                pageSize=100 # Adjust page size as needed (max 1000, default 100)
            ).execute()

            files = response.get('files', [])
            if not files:
                 logging.info("No new files found matching the criteria on this page.")
                 # No need to update state if no files were processed in this batch
                 break # Exit if no files on the current page (could be first or subsequent)

            logging.info(f"Found {len(files)} files on this page.")

            # Keep track of the latest timestamp processed *within this batch*
            batch_latest_processed_timestamp = None

            # 5. Process each file in the current batch
            for file_item in files:
                files_processed_count += 1
                file_id = file_item.get('id')
                file_name = file_item.get('name')
                mime_type = file_item.get('mimeType')
                created_time = file_item.get('createdTime') # ISO 8601 format string

                # We already filtered folders in the query, but double-check doesn't hurt
                if mime_type == 'application/vnd.google-apps.folder':
                    logging.warning(f"Skipping unexpected folder in results: '{file_name}' (ID: {file_id})")
                    continue

                logging.info(f"Processing file: '{file_name}' (ID: {file_id}, Created: {created_time})")

                if not created_time:
                    logging.warning(f"File '{file_name}' (ID: {file_id}) is missing creation time. Using fallback date folder.")
                    hebrew_date_folder_name = "תאריך_לא_ידוע"
                else:
                    # 6. Convert date and determine target folder name
                    hebrew_date_folder_name = convert_to_hebrew_month_year(created_time)

                try:
                    # 7. Get or Create Target Subfolder
                    destination_folder_id = get_or_create_folder(service, hebrew_date_folder_name, TARGET_BASE_FOLDER_ID)

                    # 8. Move the file
                    if move_file(service, file_id, file_name, SOURCE_FOLDER_ID, destination_folder_id):
                        # 9. Log to CSV on successful move
                        append_song_to_csv(NEW_CSV_FILE, next_serial, file_name, hebrew_date_folder_name, "סינגלים חדשים", file_id)
                        next_serial += 1
                        files_moved_count += 1
                        # Update the latest timestamp processed in *this batch*
                        # Since files are ordered by createdTime asc, the last successful one is the latest
                        batch_latest_processed_timestamp = created_time
                    else:
                        # Move failed (error already logged in move_file)
                        logging.error(f"Skipping CSV entry and state update for file '{file_name}' (ID: {file_id}) due to move failure.")
                        # Decide if we should stop the whole process or just skip? Currently skipping.

                except Exception as e:
                     logging.error(f"Failed to process file '{file_name}' (ID: {file_id}): {e}")
                     # Decide whether to continue or stop; let's continue for now
                     continue

            # 10. Update and Save State *after processing the batch*
            if batch_latest_processed_timestamp:
                global_latest_processed_timestamp = batch_latest_processed_timestamp
                save_migrator_state(global_latest_processed_timestamp)
            else:
                 # This can happen if a batch had files, but none were successfully moved/processed
                 logging.info("No files successfully processed in this batch. State remains unchanged.")


            # 11. Check for next page
            page_token = response.get('nextPageToken', None)
            if page_token is None:
                logging.info("No more pages of files to process.")
                break # Exit loop if no more pages
            else:
                logging.info("Fetching next page of files...")
                time.sleep(1) # Small delay before next API call

        except HttpError as error:
            logging.error(f"An API error occurred during file listing: {error}")
            # Decide if retryable or fatal. For now, break loop on listing error.
            break
        except Exception as e:
            logging.error(f"An unexpected error occurred during file listing/processing loop: {e}")
            break

    logging.info(f"--- Drive Migrator Script End ---")
    logging.info(f"Total files checked (matching criteria): {files_processed_count}")
    logging.info(f"Total files successfully moved and logged in this run: {files_moved_count}")
    logging.info(f"Next available serial number: {next_serial}")
    logging.info(f"Last processed timestamp saved to state: {global_latest_processed_timestamp or 'None'}")


if __name__ == "__main__":
    main()